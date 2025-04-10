import React, { useEffect } from 'react';

const HubSpotChat = () => {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = '//js.hs-scripts.com/YOUR_PORTAL_ID.js'; // Replace YOUR_PORTAL_ID
    script.id = 'hs-script-loader';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    // Cleanup to remove the script when the component unmounts
    return () => {
      document.body.removeChild(script);
    };
  }, []); // Empty dependency array ensures this runs only once on mount

  return null; // No UI needed, just the script
};

export default HubSpotChat;