import React, {useCallback, useEffect, useRef, useState} from 'react';
import CodeMirror, { EditorView, hoverTooltip, Tooltip, TooltipView} from '@uiw/react-codemirror';

import { json } from "@codemirror/lang-json";



import { tags as t } from '@lezer/highlight';
import createTheme from "@uiw/codemirror-themes";
import {Button} from "antd";
import {PATH_CONSOLE} from "../../constants";
import {useNavigate} from "react-router-dom";
import ReactDOM from "react-dom/client";
import idFragmentDecorator from './idFragmentDecorator'


const myTheme = createTheme({
    theme: 'light',
    settings: {
        background: '#ffffff',
        backgroundImage: '',
        foreground: '#6e7073',
        caret: '#5d00ff',
        selection: '#036dd626',
        selectionMatch: '#036dd626',
        lineHighlight: '#8a91991a',
        gutterBackground: '#fff',
        gutterForeground: '#8a919966',

    },
    styles: [
        { tag: t.comment, color: '#787b8099' },
        { tag: t.variableName, color: '#0080ff' },
        { tag: [t.string, t.special(t.brace)], color: '#117207' },
        { tag: t.number, color: '#880f41' },
        { tag: t.bool, color: '#5c6166' },
        { tag: t.float, color: '#880f41' },

        { tag: t.null, color: '#5c6166' },
        { tag: t.keyword, color: '#5c6166' },
        { tag: t.operator, color: '#5c6166' },
        { tag: t.className, color: '#5c6166' },
        { tag: t.definition(t.typeName), color: '#5c6166' },
        { tag: t.typeName, color: '#5c6166' },
        { tag: t.angleBracket, color: '#5c6166' },
        { tag: t.tagName, color: '#5c6166' },
        { tag: t.attributeName, color: '#5c6166' },
        {tag: t.propertyName, color: '#034385'}
    ],
});


const Test: React.FC = () => {
    const [tooltipPosition, setTooltipPosition] = useState<{ pos: number; side: 1 | -1 } | null>(null);
    const tooltipRootRef = useRef<ReactDOM.Root | null>(null);

    const [hoveredToken, setHoveredToken] = useState('');
    const editorRef = useRef<EditorView>(null);
    const [value, setValue] = useState(`66666666666666688
    some text {"command:"portfolios.positions":"?" , "par1":"555"} some another text 
    {"command:"portfolios.history" "_id":"?" , "par2":"555"} 
    ` );
    const navigate = useNavigate();


    const [mounted, setMounted] = useState(true);

    const handleHoverWORK = (view: EditorView, pos: number, side: 1 | -1) => {
    let {from, to, text} = view.state.doc.lineAt(pos)
        let start = pos, end = pos
        while (start > from && /\w/.test(text[start - from - 1])) start--
        while (end < to && /\w/.test(text[end - from])) end++
        if (start == pos && side < 0 || end == pos && side > 0)
            return null
        const token = text.slice(start - from, end - from);
        const tooltipContent = `Hovered token:  ${text.slice(start - from, end - from)}`;
          const dom = document.createElement('div');
          dom.textContent = tooltipContent;
          dom.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
          dom.style.color = 'white';
          dom.style.padding = '4px 8px';
          dom.style.borderRadius = '4px';
        return {
            pos: start,
            end,
            above: true,
            dom,
            create() {
                let dom = document.createElement("div")
                dom.textContent = text.slice(start - from, end - from)
                return {dom}
            }

        };
    }


    function findNearestCommandFromLeft(cm:EditorView, pos: number) {
         let {from, to, text} = cm.state.doc.lineAt(pos)
console.log(pos, from, to, text);
        const leftPart = text.slice(0, pos);
        const rightPart = text.slice(pos);
        const regex = /"command":\s*"([^"]+)"/g;
        const idRegex = /"_id":\s*"\?"/;
        let match;
        let nearestCommand = null;
        let nearestCommandPos = -1;

        // Check if the cursor is inside "_id":"?"
        const cursorInsideId = idRegex.test(leftPart + rightPart);
console.log('cursorInsideId', cursorInsideId);
        if (cursorInsideId) {
            // If the cursor is inside "_id":"?", search for the nearest "command" value
            while ((match = regex.exec(leftPart)) !== null) {
                const commandPos = match.index + match[0].indexOf(match[1]);
                if (commandPos < pos && commandPos > nearestCommandPos) {
                    nearestCommand = match[1];
                    nearestCommandPos = commandPos;
                }
            }
        }
console.log('nearestCommand', nearestCommand);
        return nearestCommand;
    }

    useEffect(() => {
        setMounted(true);

        return () => {
            setMounted(false);
        };
    }, []);


    const handleHover = (view: EditorView, pos: number, side: 1 | -1) => {
        let {from, to, text} = view.state.doc.lineAt(pos)
      let start = pos, end = pos
        while (start > from && /\w/.test(text[start - from - 1])) start--
        while (end < to && /\w/.test(text[end - from])) end++
        if (start == pos && side < 0 || end == pos && side > 0)
            return null
     /*   const token = text.slice(start - from, end - from);
        const tooltipContent = `Hovered token:  ${text.slice(start - from, end - from)}`;*/

        const dom = document.createElement('div');
        //dom.textContent = tooltipContent;
        dom.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
        dom.style.color = 'white';
        dom.style.padding = '4px 8px';
        dom.style.borderRadius = '4px';
      /*  if (!tooltipRootRef.current && mounted) {
            tooltipRootRef.current = ReactDOM.createRoot(dom);
        }*/
        const tooltipContent =   findNearestCommandFromLeft(view, pos) || '';
        if(!tooltipContent) {
            return null;
        }
        // mounted && tooltipRootRef.current&& tooltipRootRef.current.render((<>{tooltipContent}<ul><li onClick={()=>alert('10')}>newValue1</li></ul></>));
        dom.innerHTML =`{${tooltipContent}<ul>
            <li onClick="alert('10')">newValue1</li>
            <li onClick="alert('2')">newValue2</li>
         </ul>`
        return {
            pos: start,
            end,
            above: true,
            dom,
            create() {


                return {dom}
            }

        };
    }



    const createTooltipView = (container: HTMLDivElement, side: 1 | -1, pos: number)=> ({
        pos,
        end: side > 0 ? pos : undefined,
        create: ()=> ({
            dom:container
        })
    });
    const handleHover00 = (view: EditorView, pos: number, side: 1 | -1) => {
        const { state } = view;
        let {from, to, text} = view.state.doc.lineAt(pos)
        let start = pos, end = pos
        while (start > from && /\w/.test(text[start - from - 1])) start--
        while (end < to && /\w/.test(text[end - from])) end++
        if (start == pos && side < 0 || end == pos && side > 0)
            return null
        const token = text.slice(start - from, end - from);

        if (token.trim()) {
            setHoveredToken(token);
            setTooltipPosition({ pos, side});
        } else {
            setTooltipPosition(null);
        }
    };


  /*  const handleReplaceToken = (newToken:string) => {
        const view = editorRef.current;
        const { state } = view;
        const changes = [
            {
                from: state.selection.main.from,
                to: state.selection.main.to,
                insert: newToken,
            },
        ];
        view.dispatch({ changes });
        setTooltipPosition(null);
    };*/
    const handleHover3 = (view: EditorView, pos: number, side: 1 | -1): Tooltip | null => {
        const { state } = view;
        let {from, to, text} = view.state.doc.lineAt(pos)
        let start = pos, end = pos
        while (start > from && /\w/.test(text[start - from - 1])) start--
        while (end < to && /\w/.test(text[end - from])) end++
        if (start == pos && side < 0 || end == pos && side > 0)
            return null
        const token = text.slice(start - from, end - from);
        if (token.trim()) {
            setHoveredToken(token);
            setTooltipPosition({pos, side});

            const line = state.doc.lineAt(pos);
            const tokenText = line.text.slice(pos - line.from, pos);

            const tooltipContent = (
                <div>
                    <p>Hovered token: {tokenText}</p>
                    <ul>
                        <li onClick={() => handleReplaceToken('newValue1')}>newValue1</li>
                        <li onClick={() => handleReplaceToken('newValue2')}>newValue2</li>
                        {/* Add more options as needed */}
                    </ul>
                </div>
            );

            const container = document.createElement('div');
            if (!tooltipRootRef.current) {
                tooltipRootRef.current = ReactDOM.createRoot(container);
            }
            tooltipRootRef.current.render(tooltipContent);

            return createTooltipView(container, side, pos);
        }else {
            setTooltipPosition(null);
        }
        return null;
    };

    const handleReplaceToken = (newToken: string) => {
        const view = editorRef.current;
        if (view) {
            const { state } = view;
            const changes = [
                {
                    from: state.selection.main.from,
                    to: state.selection.main.to,
                    insert: newToken,
                },
            ];
            view.dispatch({ changes });
            setTooltipPosition(null);
        }
    };

    useEffect(() => {
        return () => {
            if (tooltipRootRef.current) {
                tooltipRootRef.current.unmount();
            }
        };
    }, []);


    return (
        <div style={{height:'500px', display:'flex', flexDirection:'column'}}>

            <CodeMirror
                ref={editorRef}
                theme={myTheme}
                value={value}
                height="200px"
                width={'800px'}
                // @ts-ignore
                extensions={[json(),  hoverTooltip(handleHover), idFragmentDecorator]}
                onChange = {(val: string) => {
                  setValue(val);
                  }}


            />
            <hr/>
            <Button onClick={()=>     navigate(PATH_CONSOLE)}>Back</Button>
</div>
    );
};

export default Test
