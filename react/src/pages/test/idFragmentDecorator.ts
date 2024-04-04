import { EditorView, Decoration, DecorationSet, ViewPlugin, WidgetType } from '@codemirror/view';
import { syntaxTree} from '@codemirror/language';
import {ViewUpdate} from "@uiw/react-codemirror";

interface IdFragment {
    from: number;
    to: number;
}

function findIdFragments(view: EditorView): IdFragment[] {
    const idFragments: IdFragment[] = [];
    const tree = syntaxTree(view.state);

    tree.cursor().iterate((node) => {
        if (node.type.name === 'String' && node.node.toString() === '"_id":"?"') {
            const from = node.node.from;
            const to = node.node.to;
            idFragments.push({ from, to });
        }
        return true;
    });

    return idFragments;
}

function decorateIdFragments(view: EditorView): DecorationSet {
    const idFragments = findIdFragments(view);
    const decorations = idFragments.map((fragment) => {
        const button = document.createElement('button');
        button.textContent = 'Replace';
        button.style.marginLeft = '5px';
        button.style.cursor = 'pointer';

        const decoration = Decoration.widget({
            widget: button as unknown as WidgetType,
            side: 1,
        }).range(fragment.from, fragment.to);

        return decoration;
    });

    return Decoration.set(decorations);
}


const idFragmentDecorator = ViewPlugin.fromClass(
    class {
        public decorations: DecorationSet;

        constructor(view: EditorView) {
            this.decorations = this.getDecorations(view);
        }

        update(update: ViewUpdate) {
            if (update.docChanged || update.viewportChanged) {
                this.decorations = this.getDecorations(update.view);
            }
        }

        getDecorations(view: EditorView): DecorationSet {
            return decorateIdFragments(view);
        }
    },
    {
        decorations: (v) => v.decorations,
    }
);
export default idFragmentDecorator
