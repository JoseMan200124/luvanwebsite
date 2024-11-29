// src/pages/SimpleEditor.jsx

import React, { useState, useRef } from 'react';
import ReactQuill from 'react-quill';
import EditorToolbar, { modules, formats } from '../components/EditorToolbar';
import 'react-quill/dist/quill.snow.css';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    Select,
    MenuItem,
    InputLabel,
    FormControl,
    Fab
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ErrorBoundary from '../components/ErrorBoundary';

const SimpleEditor = ({ editorData, setEditorData }) => {
    const [openPlaceholderDialog, setOpenPlaceholderDialog] = useState(false);
    const [placeholderName, setPlaceholderName] = useState('');
    const [placeholderType, setPlaceholderType] = useState('text');

    const quillRef = useRef(null);

    const handleEditorChange = (content, delta, source, editor) => {
        setEditorData(content);
    };

    const handleInsertPlaceholder = () => {
        if (!placeholderName.trim()) {
            alert('Por favor, ingrese un nombre para el campo.');
            return;
        }

        const quill = quillRef.current.getEditor();
        const range = quill.getSelection(true);
        const placeholderText = `{{${placeholderName}:${placeholderType}}}`;
        quill.insertText(range.index, placeholderText, 'user');
        quill.setSelection(range.index + placeholderText.length, 'silent');

        setPlaceholderName('');
        setPlaceholderType('text');
        setOpenPlaceholderDialog(false);
    };

    return (
        <div style={{ position: 'relative' }}>
            <EditorToolbar />
            <ReactQuill
                ref={quillRef}
                theme="snow"
                value={editorData}
                onChange={handleEditorChange}
                placeholder="Escribe tu contenido aquí..."
                modules={modules}
                formats={formats}
            />

            {/* Botón Flotante para Insertar Placeholder */}
            <Fab
                color="primary"
                aria-label="add"
                style={{
                    position: 'absolute',
                    bottom: '20px',
                    right: '20px',
                }}
                onClick={() => setOpenPlaceholderDialog(true)}
            >
                <AddIcon />
            </Fab>

            {/* Diálogo para insertar placeholder */}
            <Dialog open={openPlaceholderDialog} onClose={() => setOpenPlaceholderDialog(false)}>
                <DialogTitle>Insertar Campo</DialogTitle>
                <DialogContent>
                    <TextField
                        label="Nombre del Campo"
                        value={placeholderName}
                        onChange={(e) => setPlaceholderName(e.target.value)}
                        fullWidth
                        margin="normal"
                        placeholder="e.g., NOMBRE, EDAD"
                    />
                    <FormControl fullWidth margin="normal">
                        <InputLabel id="placeholder-type-label">Tipo de Campo</InputLabel>
                        <Select
                            labelId="placeholder-type-label"
                            value={placeholderType}
                            onChange={(e) => setPlaceholderType(e.target.value)}
                            label="Tipo de Campo"
                        >
                            <MenuItem value="text">Texto</MenuItem>
                            <MenuItem value="number">Número</MenuItem>
                            <MenuItem value="date">Fecha</MenuItem>
                            <MenuItem value="signature">Firma</MenuItem>
                            {/* Agrega más tipos si es necesario */}
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenPlaceholderDialog(false)}>Cancelar</Button>
                    <Button onClick={handleInsertPlaceholder} variant="contained" color="primary">
                        Insertar
                    </Button>
                </DialogActions>
            </Dialog>
        </div>
    );
};

export default SimpleEditor;
