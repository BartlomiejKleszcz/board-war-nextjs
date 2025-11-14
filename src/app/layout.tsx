import "./globals.css";

export const metadata = {
  title: "Board War",
  description: "A strategic board game experience",
};


function RootLayout({ children }: { children: React.ReactNode }) {


  return (
    <html lang="en">
      <header > 
        <h1>Board War</h1>
        <p>New Game</p>
        <p>Units</p>
        <p>About</p>
      </header>
      <body >{children}</body>
    </html>
  );
}

export default RootLayout;