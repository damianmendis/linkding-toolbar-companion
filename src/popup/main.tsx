import { createRoot } from 'react-dom/client';
import { Popup } from './Popup';
import '../assets/globals.css';
import './popup.css';

const root = document.getElementById('root')!;
createRoot(root).render(<Popup />);
