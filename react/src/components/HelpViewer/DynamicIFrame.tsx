import React, {useEffect, useRef, useState} from "react";

const DynamicIFrame = ({ src }: { src: string }) => {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState<string>('0px');

  const onLoad = () => {
    if (ref.current) {
      console.log('LLL-------', ref.current.contentWindow?.document.body.scrollHeight)
      setHeight(`${ref.current.contentWindow?.document.body.scrollHeight}px`);
    }
  };

  useEffect(() => {
    onLoad();
  }, []);

  return (
      <iframe
          ref={ref}
          onLoad={onLoad}
          className='w-full'
          id='iframe'
          srcDoc={src}
          height={height}

      ></iframe>
  );
};

export default DynamicIFrame;
