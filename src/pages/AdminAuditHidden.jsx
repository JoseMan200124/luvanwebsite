import React, { useEffect, useMemo, useState } from 'react';
import api from '../utils/axiosConfig';
import moment from 'moment';
import copy from 'copy-to-clipboard';
import axios from 'axios';

// NOT LINKED anywhere; direct access only via URL path you configure below in App.jsx
export default function AdminAuditHidden() {
	const [items, setItems] = useState([]);
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(20);
	const [total, setTotal] = useState(0);
		const [loading, setLoading] = useState(false);
		const [error, setError] = useState('');

	// Modal state for viewing long fields (UA, Antes, Después)
	const [modal, setModal] = useState({ open: false, title: '', content: null, isJson: false });

	const [filters, setFilters] = useState({ action: '', entity: '', performedBy: '', from: '', to: '', q: '' });

	// Text compare section state
	const [cmpA, setCmpA] = useState('');
	const [cmpB, setCmpB] = useState('');
	const [cmpRows, setCmpRows] = useState([]);
	const [optIgnoreWs, setOptIgnoreWs] = useState(false);
	const [optIgnoreCase, setOptIgnoreCase] = useState(false);

	const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

	const fetchData = async () => {
		setLoading(true);
			try {
			const params = { page, pageSize };
			Object.entries(filters).forEach(([k, v]) => {
				if (v) params[k] = v;
			});
			const { data } = await api.get('/audit', { params });
			setItems(data.items || []);
			setTotal(data.total || 0);
		} catch (e) {
				console.error(e);
				setError(e?.response?.data?.message || e?.message || 'Error');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchData();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [page, pageSize]);

	const openModal = (title, content, isJson = false) => {
		setModal({ open: true, title, content, isJson });
	};

	const closeModal = () => setModal((m) => ({ ...m, open: false }));

	// Utility to compute inline diff parts for a pair of strings
	const computeDiffParts = (a = '', b = '') => {
		if (a === b) return { a: { pre: a, mid: '', suf: '' }, b: { pre: b, mid: '', suf: '' } };
		let start = 0;
		const minLen = Math.min(a.length, b.length);
		while (start < minLen && a[start] === b[start]) start++;
		let enda = a.length - 1;
		let endb = b.length - 1;
		while (enda >= start && endb >= start && a[enda] === b[endb]) { enda--; endb--; }
		return {
			a: {
				pre: a.slice(0, start),
				mid: a.slice(start, enda + 1),
				suf: a.slice(enda + 1)
			},
			b: {
				pre: b.slice(0, start),
				mid: b.slice(start, endb + 1),
				suf: b.slice(endb + 1)
			}
		};
	};

	const normalizeForCompare = (s) => {
		let out = s == null ? '' : String(s);
		if (optIgnoreWs) out = out.replace(/\s+/g, '');
		if (optIgnoreCase) out = out.toLowerCase();
		return out;
	};

	const compareTexts = () => {
		const A = (cmpA || '').replaceAll('\r\n', '\n');
		const B = (cmpB || '').replaceAll('\r\n', '\n');
		const la = A.split('\n');
		const lb = B.split('\n');
		const max = Math.max(la.length, lb.length);
		const rows = [];
		for (let i = 0; i < max; i++) {
			const left = la[i] ?? '';
			const right = lb[i] ?? '';
			const nLeft = normalizeForCompare(left);
			const nRight = normalizeForCompare(right);
			if (nLeft === nRight) {
				rows.push({ type: 'same', left, right });
			} else if (left && !right) {
				rows.push({ type: 'a-only', left, right: '' });
			} else if (!left && right) {
				rows.push({ type: 'b-only', left: '', right });
			} else {
				rows.push({ type: 'diff', left, right, parts: computeDiffParts(left, right) });
			}
		}
		setCmpRows(rows);
	};

	const formatJson = (side) => {
		try {
			if (side === 'A') {
				const obj = JSON.parse(cmpA);
				setCmpA(JSON.stringify(obj, null, 2));
			} else {
				const obj = JSON.parse(cmpB);
				setCmpB(JSON.stringify(obj, null, 2));
			}
		} catch (e) {
			alert(`JSON inválido en ${side}.`);
		}
	};

	const onSearch = (e) => {
		e.preventDefault();
		setPage(1);
		fetchData();
	};

	const downloadCsv = async () => {
		const params = new URLSearchParams();
		Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
		const baseURL = api.defaults.baseURL?.replace(/\/$/, '') || '';
		const url = `${baseURL}/audit/export/csv?${params.toString()}`;
		const token = localStorage.getItem('token');
		try {
			const response = await axios.get(url, {
				responseType: 'blob',
				headers: { Authorization: token ? `Bearer ${token}` : undefined }
			});
			const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8' });
			const link = document.createElement('a');
			const dl = window.URL.createObjectURL(blob);
			link.href = dl;
			link.download = `audit-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'')}.csv`;
			document.body.appendChild(link);
			link.click();
			link.remove();
			setTimeout(() => URL.revokeObjectURL(dl), 2000);
		} catch (e) {
			alert(e?.response?.data?.message || e?.message || 'Error al descargar CSV');
		}
	};

	const deleteOne = async (id) => {
		if (!window.confirm('¿Eliminar este log?')) return;
		await api.delete(`/audit/${id}`);
		fetchData();
	};

	const deleteByFilter = async () => {
		if (!window.confirm('¿Eliminar todos los logs que coinciden con los filtros actuales? Esta acción es irreversible.')) return;
		const body = {};
		Object.entries(filters).forEach(([k, v]) => { if (v) body[k] = v; });
		const { data } = await api.post('/audit/delete-by-filter', body);
		alert(`Eliminados: ${data.deleted}`);
		setPage(1);
		fetchData();
	};

	const deleteGroup = async (ids) => {
		if (!ids || ids.length === 0) return;
		if (!window.confirm(`¿Eliminar los ${ids.length} logs de este grupo?`)) return;
		await api.post('/audit/delete-by-ids', { ids });
		fetchData();
	};

	const Field = ({ label, children }) => (
		<label className="block text-sm text-gray-600">
			<span className="mr-2 font-medium text-gray-800">{label}</span>
			{children}
		</label>
	);

		const CopyButton = ({ text }) => {
			const [copied, setCopied] = useState(false);
			const handleCopy = () => {
				const t = text == null ? '' : typeof text === 'string' ? text : JSON.stringify(text);
				copy(t);
				setCopied(true);
				setTimeout(() => setCopied(false), 1200);
			};
			return (
				<button
					type="button"
					onClick={handleCopy}
					className={`px-2 py-0.5 border rounded text-xs ${copied ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
					title="Copiar"
				>
					{copied ? 'Copiado' : 'Copiar'}
				</button>
			);
		};

	return (
		<>
		<div className="p-6 max-w-[1800px] mx-auto">
			<h1 className="text-2xl font-semibold mb-4">Auditoría del sistema</h1>
			<p className="text-sm text-gray-600 mb-4">Página oculta. Acceso directo y solo Gestor.</p>

			<form onSubmit={onSearch} className="grid grid-cols-1 md:grid-cols-6 gap-3 bg-white p-4 rounded border mb-4">
				<Field label="Acción">
					<input value={filters.action} onChange={e=>setFilters(f=>({...f, action:e.target.value}))} className="border rounded px-2 py-1 w-full" placeholder="CREATE/UPDATE/DELETE" />
				</Field>
				<Field label="Entidad">
					<input value={filters.entity} onChange={e=>setFilters(f=>({...f, entity:e.target.value}))} className="border rounded px-2 py-1 w-full" placeholder="User, Payment, ..." />
				</Field>
				<Field label="Usuario (ID)">
					<input value={filters.performedBy} onChange={e=>setFilters(f=>({...f, performedBy:e.target.value}))} className="border rounded px-2 py-1 w-full" placeholder="ID" />
				</Field>
				<Field label="Desde">
					<input type="date" value={filters.from} onChange={e=>setFilters(f=>({...f, from:e.target.value}))} className="border rounded px-2 py-1 w-full" />
				</Field>
				<Field label="Hasta">
					<input type="date" value={filters.to} onChange={e=>setFilters(f=>({...f, to:e.target.value}))} className="border rounded px-2 py-1 w-full" />
				</Field>
				<Field label="Buscar (ruta/IP/etc)">
					<input value={filters.q} onChange={e=>setFilters(f=>({...f, q:e.target.value}))} className="border rounded px-2 py-1 w-full" placeholder="/api/users, 10.0.0.1 ..." />
				</Field>

				<div className="md:col-span-6 flex items-center gap-2 mt-2">
					<button type="submit" className="bg-blue-600 text-white px-3 py-1 rounded disabled:opacity-50" disabled={loading}>Filtrar</button>
					<button type="button" className="bg-gray-500 text-white px-3 py-1 rounded" onClick={()=>{setFilters({action:'',entity:'',performedBy:'',from:'',to:'',q:''}); setPage(1);}}>Limpiar</button>
					<span className="mx-2 text-sm text-gray-500">Total: {total}</span>
					<div className="ml-auto flex items-center gap-2">
						<select value={pageSize} onChange={(e)=>{setPageSize(parseInt(e.target.value)||20); setPage(1);}} className="border rounded px-2 py-1">
							{[20,50,100,200].map(s=> <option key={s} value={s}>{s}/página</option>)}
						</select>
						<button type="button" className="bg-emerald-600 text-white px-3 py-1 rounded" onClick={downloadCsv}>Descargar CSV</button>
						<button type="button" className="bg-red-600 text-white px-3 py-1 rounded" onClick={deleteByFilter}>Eliminar por Filtros</button>
					</div>
				</div>
			</form>

			{/* Text compare section */}
			<div className="bg-white p-4 rounded border mb-4">
				<h2 className="text-lg font-semibold mb-2">Comparador de textos</h2>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
					<div>
						<label className="block text-sm text-gray-700 mb-1">Texto A</label>
						<textarea value={cmpA} onChange={(e)=>setCmpA(e.target.value)} className="w-full border rounded p-2 h-32 font-mono text-sm" placeholder="Pega el primer texto aquí..."></textarea>
						<div className="mt-1 flex gap-2">
							<button type="button" className="px-2 py-0.5 border rounded text-xs bg-white hover:bg-gray-50" onClick={()=>formatJson('A')}>Formatear JSON (A)</button>
						</div>
					</div>
					<div>
						<label className="block text-sm text-gray-700 mb-1">Texto B</label>
						<textarea value={cmpB} onChange={(e)=>setCmpB(e.target.value)} className="w-full border rounded p-2 h-32 font-mono text-sm" placeholder="Pega el segundo texto aquí..."></textarea>
						<div className="mt-1 flex gap-2">
							<button type="button" className="px-2 py-0.5 border rounded text-xs bg-white hover:bg-gray-50" onClick={()=>formatJson('B')}>Formatear JSON (B)</button>
						</div>
					</div>
				</div>
				<div className="flex flex-col md:flex-row md:items-center gap-3 mb-3">
					<div className="flex items-center gap-4">
						<label className="inline-flex items-center gap-2 text-sm">
							<input type="checkbox" checked={optIgnoreWs} onChange={(e)=>setOptIgnoreWs(e.target.checked)} />
							<span>Ignorar espacios</span>
						</label>
						<label className="inline-flex items-center gap-2 text-sm">
							<input type="checkbox" checked={optIgnoreCase} onChange={(e)=>setOptIgnoreCase(e.target.checked)} />
							<span>Ignorar mayúsculas/minúsculas</span>
						</label>
					</div>
					<div className="flex gap-2">
						<button type="button" className="bg-blue-600 text-white px-3 py-1 rounded" onClick={compareTexts}>Comparar (líneas)</button>
						<button type="button" className="bg-gray-500 text-white px-3 py-1 rounded" onClick={()=>{setCmpA(''); setCmpB(''); setCmpRows([]);}}>Limpiar</button>
					</div>
				</div>
				{cmpRows.length > 0 && (
					<div className="border rounded overflow-hidden">
						<div className="grid grid-cols-2 text-xs font-semibold bg-gray-100">
							<div className="p-2 border-r">A</div>
							<div className="p-2">B</div>
						</div>
						<div className="max-h-64 overflow-auto">
							{cmpRows.map((r, idx)=> (
								<div key={idx} className="grid grid-cols-2 text-sm border-t">
									<div className={`p-1 border-r font-mono whitespace-pre-wrap break-words ${r.type==='same'?'':'bg-red-50'}`}>
										{r.type==='diff' && r.parts ? (
											<>
												<span>{r.parts.a.pre}</span>
												<mark className="bg-red-200">{r.parts.a.mid}</mark>
												<span>{r.parts.a.suf}</span>
											</>
										) : (
											<span>{r.left}</span>
										)}
									</div>
									<div className={`p-1 font-mono whitespace-pre-wrap break-words ${r.type==='same'?'':'bg-green-50'}`}>
										{r.type==='diff' && r.parts ? (
											<>
												<span>{r.parts.b.pre}</span>
												<mark className="bg-green-200">{r.parts.b.mid}</mark>
												<span>{r.parts.b.suf}</span>
											</>
										) : (
											<span>{r.right}</span>
										)}
									</div>
								</div>
							))}
						</div>
					</div>
				)}
			</div>

					{error && (
						<div className="mb-3 p-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded">{error}</div>
					)}
					<div className="overflow-auto bg-white border rounded">
				<table className="min-w-full text-sm">
					<thead className="bg-gray-100">
										<tr>
										<th className="text-left p-2">Fecha</th>
										<th className="text-left p-2">Acción</th>
										<th className="text-left p-2">Entidad</th>
										<th className="text-left p-2">ID</th>
										<th className="text-left p-2">Usuario</th>
										<th className="text-left p-2">Ruta</th>
										<th className="text-left p-2">UA</th>
										<th className="text-left p-2">Antes</th>
										<th className="text-left p-2">Después</th>
										<th className="text-left p-2">Acciones</th>
										<th className="text-left p-2">#</th>
									</tr>
					</thead>
					<tbody>
						{items.map((row)=> (
							<tr key={row.id || (row._ids && row._ids[0])} className="border-t">
												<td className="p-2 whitespace-nowrap">
													<span>{moment(row.createdAt).format('YYYY-MM-DD HH:mm:ss')}</span>
												</td>
												<td className="p-2 font-medium">
													<span>{row.action}</span>
												</td>
												<td className="p-2">
													<span>{row.entity}</span>
												</td>
												<td className="p-2">
													<span>{row.entityId}</span>
												</td>
												<td className="p-2">
													<span>{row.user ? `${row.user.name} (#${row.user.id})` : '-'}</span>
												</td>
												<td className="p-2 max-w-[420px] truncate" title={row.path}>
													<span className="truncate">{row.path || '-'}</span>
												</td>
												<td className="p-2 max-w-[420px] truncate" title={row.userAgent}>
													<div className="flex items-center gap-2 w-full">
														<span className="truncate">{row.userAgent || '-'}</span>
														{row.userAgent && (
															<button
																type="button"
																className="px-2 py-0.5 border rounded text-xs bg-white text-gray-700 hover:bg-gray-50"
																onClick={() => openModal('User Agent completo', row.userAgent, false)}
															>
																Ver
															</button>
														)}
													</div>
												</td>
												<td className="p-2 align-top">
													<div className="flex items-start gap-2">
														<pre className="max-w-[520px] max-h-28 overflow-auto bg-gray-50 p-2 rounded flex-1">{row.before ? JSON.stringify(row.before, null, 2) : '-'}</pre>
														<div className="flex flex-col gap-1">
															<CopyButton text={row.before ? JSON.stringify(row.before) : ''} />
															{row.before && (
																<button
																	type="button"
																	className="px-2 py-0.5 border rounded text-xs bg-white text-gray-700 hover:bg-gray-50"
																	onClick={() => openModal(`Antes - ${row.entity} #${row.entityId}`, row.before, true)}
																>
																	Ver
																</button>
															)}
														</div>
													</div>
												</td>
												<td className="p-2 align-top">
													<div className="flex items-start gap-2">
														<pre className="max-w-[520px] max-h-28 overflow-auto bg-gray-50 p-2 rounded flex-1">{row.after ? JSON.stringify(row.after, null, 2) : '-'}</pre>
														<div className="flex flex-col gap-1">
															<CopyButton text={row.after ? JSON.stringify(row.after) : ''} />
															{row.after && (
																<button
																	type="button"
																	className="px-2 py-0.5 border rounded text-xs bg-white text-gray-700 hover:bg-gray-50"
																	onClick={() => openModal(`Después - ${row.entity} #${row.entityId}`, row.after, true)}
																>
																	Ver
																</button>
															)}
														</div>
													</div>
												</td>
												<td className="p-2 space-x-2">
													<button className="bg-red-600 text-white px-2 py-1 rounded" onClick={()=>deleteOne(row.id || (row._ids && row._ids[0]))}>Eliminar</button>
													{row._ids && row._ids.length > 1 && (
														<button className="bg-red-700 text-white px-2 py-1 rounded" title="Eliminar todo el grupo" onClick={()=>deleteGroup(row._ids)}>Eliminar grupo</button>
													)}
												</td>
												<td className="p-2 text-center whitespace-nowrap">{row._count || 1}</td>
							</tr>
						))}
						{items.length === 0 && !loading && (
							<tr><td className="p-4 text-center text-gray-500" colSpan={11}>Sin resultados</td></tr>
						)}
						{loading && (
							<tr><td className="p-4 text-center text-gray-500" colSpan={11}>Cargando...</td></tr>
						)}
					</tbody>
				</table>
			</div>

			<div className="flex justify-between items-center mt-3">
				<div className="text-sm text-gray-600">Página {page} de {totalPages}</div>
				<div className="flex gap-2">
					<button className="px-3 py-1 border rounded" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Anterior</button>
					<button className="px-3 py-1 border rounded" disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)}>Siguiente</button>
				</div>
			</div>
	</div>

	{modal.open && (
			<div
				className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
				onClick={closeModal}
			>
				<div
					className="bg-white rounded shadow-xl max-w-[90vw] max-h-[85vh] w-[1000px] overflow-hidden"
					onClick={(e) => e.stopPropagation()}
				>
					<div className="flex items-center justify-between border-b px-4 py-2">
						<h2 className="font-semibold text-gray-800 text-base">{modal.title}</h2>
						<button
							type="button"
							className="text-gray-600 hover:text-black text-xl leading-none"
							onClick={closeModal}
						>
							×
						</button>
					</div>
					<div className="p-4 overflow-auto max-h-[70vh]">
						{modal.isJson ? (
							<pre className="text-sm bg-gray-50 p-3 rounded whitespace-pre-wrap break-words">{JSON.stringify(modal.content, null, 2)}</pre>
						) : (
							<div className="text-sm break-all whitespace-pre-wrap">{String(modal.content)}</div>
						)}
					</div>
					<div className="flex justify-end gap-2 border-t px-4 py-2 bg-gray-50">
						<button
							type="button"
							className="px-3 py-1 border rounded text-sm bg-white text-gray-700 hover:bg-gray-100"
							onClick={() => copy(modal.isJson ? JSON.stringify(modal.content) : String(modal.content))}
						>
							Copiar
						</button>
						<button
							type="button"
							className="bg-blue-600 text-white px-3 py-1 rounded text-sm"
							onClick={closeModal}
						>
							Cerrar
						</button>
					</div>
				</div>
			</div>
		)}
		</>
	);
}

// Modal component rendered inline


