// CSS module imports (`import styles from './X.module.css'`).
declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}

// Plain stylesheets, imported only for their side effects
// (`import './popup.css'`); TypeScript 6 checks those imports too.
//
// Keep this AFTER the *.module.css declaration: both patterns match a
// .module.css file, and on such a tie TypeScript uses the first one
// declared -- with this one first, every CSS module would lose its class
// typing. (And keep the empty body: the `declare module '*.css';`
// shorthand types matches as `any`.)
declare module '*.css' {}
