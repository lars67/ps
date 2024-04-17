import React, { useRef, useEffect } from 'react';

const IFrameHelp = ({ src }: { src: string }) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        const resizeIframe = () => {
            if (iframeRef.current) {
                iframeRef.current.style.height = `${iframeRef.current.contentWindow?.document.body.scrollHeight}px`;
            }
        };

        resizeIframe();

        window.addEventListener('resize', resizeIframe);
        return () => {
            window.removeEventListener('resize', resizeIframe);
        };
    }, []);

    return (
        <iframe
            ref={iframeRef}
            src={src}
            style={{ width: '100%', border: 'none' }}
        />
    );
};

export default IFrameHelp;
