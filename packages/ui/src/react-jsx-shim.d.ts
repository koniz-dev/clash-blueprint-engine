// React 19's @types/react removed the global `JSX` namespace (it now lives under
// `React.JSX`). This shim re-exposes it globally so existing `JSX.Element` return
// annotations keep resolving without touching every component. Equivalent to the
// official `types-react-codemod preset-19` `JSX.Element -> React.JSX.Element` fix.
import type { JSX as ReactJSX } from "react";

declare global {
  namespace JSX {
    type ElementType = ReactJSX.ElementType;
    type Element = ReactJSX.Element;
    type ElementClass = ReactJSX.ElementClass;
    type ElementAttributesProperty = ReactJSX.ElementAttributesProperty;
    type ElementChildrenAttribute = ReactJSX.ElementChildrenAttribute;
    type LibraryManagedAttributes<C, P> = ReactJSX.LibraryManagedAttributes<C, P>;
    type IntrinsicAttributes = ReactJSX.IntrinsicAttributes;
    type IntrinsicClassAttributes<T> = ReactJSX.IntrinsicClassAttributes<T>;
    type IntrinsicElements = ReactJSX.IntrinsicElements;
  }
}
