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

    // Referencia al editor Quill
    const quillRef = useRef(null);

    // Control de cambios en el editor
    const handleEditorChange = (content, delta, source, editor) => {
        setEditorData(content);
    };

    // Insertar placeholder
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

        // Reset
        setPlaceholderName('');
        setPlaceholderType('text');
        setOpenPlaceholderDialog(false);
    };

    return (
        // Se ajusta el contenedor con maxWidth y manejo responsivo
        <div
            style={{
                width: '100%',
                maxWidth: 900,
                margin: '0 auto',
                position: 'relative',
                padding: '1rem',
                boxSizing: 'border-box',
            }}
        >
            <EditorToolbar />
            <ReactQuill
                ref={quillRef}
                theme="snow"
                value={editorData}
                onChange={handleEditorChange}
                placeholder="Escribe tu contenido aquí..."
                modules={modules}
                formats={formats}
                style={{
                    minHeight: '300px',
                    width: '100%',
                    boxSizing: 'border-box',
                }}
            />

            {/* Botón Flotante para Insertar Placeholder */}
            <Fab
                color="primary"
                aria-label="add"
                style={{
                    position: 'fixed',
                    bottom: '20px',
                    right: '20px',
                    zIndex: 9999
                }}
                onClick={() => setOpenPlaceholderDialog(true)}
            >
                <AddIcon />
            </Fab>

            {/* Diálogo para insertar placeholder */}
            <Dialog
                open={openPlaceholderDialog}
                onClose={() => setOpenPlaceholderDialog(false)}
            >
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
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenPlaceholderDialog(false)}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleInsertPlaceholder}
                        variant="contained"
                        color="primary"
                    >
                        Insertar
                    </Button>
                </DialogActions>
            </Dialog>
        </div>
    );
};

export default SimpleEditor;
