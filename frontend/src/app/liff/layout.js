export default function LiffLayout({ children }) {
  // Return plain children without the global navbar (if it was included in root layout, this might not override it unless we use Route Groups. Assuming root layout wraps everything, we might just hide navbar via CSS or pass a prop. For now, just return children.)
  return <div className="liff-container">{children}</div>;
}
