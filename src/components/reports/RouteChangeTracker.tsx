import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

// Your Google Analytics Measurement ID
const GA_MEASUREMENT_ID = 'G-YOUR_MEASUREMENT_ID'; // <-- Replace this

const RouteChangeTracker = () => {
  const location = useLocation();
  const [initialized, setInitialized] = useState(false);

  // Initialize GA
  useEffect(() => {
    // Check if the script already exists
    if (!window.gtag) {
      const script = document.createElement('script');
      script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
      script.async = true;
      document.head.appendChild(script);

      script.onload = () => {
        window.dataLayer = window.dataLayer || [];
          function gtag(...args: any[]){window.dataLayer!.push(args);}
        window.gtag = gtag; // Make gtag globally available

        gtag('js', new Date());
        gtag('config', GA_MEASUREMENT_ID);
        console.log("Google Analytics initialized");
        setInitialized(true);
      };
    } else {
        setInitialized(true);
    }
  }, []);

  // Track page views on route change
  useEffect(() => {
    if (initialized) {
      if (window.gtag) {
        window.gtag('config', GA_MEASUREMENT_ID, {
          page_path: location.pathname + location.search,
        });
        console.log(`GA page_view: ${location.pathname + location.search}`);
      }
    }
  }, [initialized, location]);

  return null; // This component does not render anything
};

export default RouteChangeTracker;