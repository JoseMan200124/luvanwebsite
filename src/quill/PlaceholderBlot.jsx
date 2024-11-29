// src/components/PlaceholderBlot.jsx

import Quill from 'quill';

const Inline = Quill.import('blots/inline');

class PlaceholderBlot extends Inline {
    static blotName = 'placeholder';
    static tagName = 'span';
    static className = 'placeholder-blot';

    static create(value) {
        let node = super.create();
        node.setAttribute('data-placeholder', value);
        node.setAttribute('contenteditable', 'false');
        node.innerText = `{{${value}}}`;
        return node;
    }

    static formats(node) {
        return node.getAttribute('data-placeholder');
    }
}

Quill.register(PlaceholderBlot);

export default PlaceholderBlot;
