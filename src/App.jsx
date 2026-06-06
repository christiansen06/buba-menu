import { useEffect, useState } from 'react';
import './App.css';

import Hero from './components/Hero';
import MenuSection from './components/MenuSection';
import StorySection from './components/StorySection';
import LocationSection from './components/LocationSection';
import InstagramSection from './components/InstagramSection';

function getCurrentView() {
  return window.location.hash === '#historia' ? 'story' : 'home';
}

function App() {
  const [view, setView] = useState(getCurrentView);

  useEffect(() => {
    const handleHashChange = () => setView(getCurrentView());

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (view === 'story') {
    return <StorySection />;
  }

  return (
      <>
        <Hero />
        <MenuSection />
        <InstagramSection />
        <LocationSection />
      </>
  );
}

export default App;
