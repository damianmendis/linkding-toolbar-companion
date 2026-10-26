import { createRoot } from 'react-dom/client';
import { Options } from './Options';
import '../assets/globals.css';
import './options.css';

const root = document.getElementById('root')!;
createRoot(root).render(<Options />);
