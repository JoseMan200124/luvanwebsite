// src/index.js
import './utils/momentSetup';
import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import './assets/styles/globals.css';

ReactDOM.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
    document.getElementById('root')
);
