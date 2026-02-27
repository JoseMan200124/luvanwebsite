import React from 'react';

function articleForNoun(noun) {
    if (!noun) return '';
    const n = String(noun).toLowerCase();
    const feminine = new Set(['familia', 'monitora']);
    return feminine.has(n) ? 'una' : 'un';
}

export default function DuplicateEmailAlert({ roleLabel, associated, includeArticle = true }) {
    const noun = roleLabel || 'usuario';
    const article = includeArticle ? `${articleForNoun(noun)} ` : '';

    return (
        <span>
            El email ingresado ya está en uso por {article}<strong>{noun}</strong>
            {associated ? (
                <span>
                    {' '}
                    ({associated.type === 'school' ? 'Colegio' : 'Corporación'}: <strong>{associated.name}</strong>)
                </span>
            ) : null}
        </span>
    );
}
