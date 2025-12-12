import Image from "next/image";
import styles from "./page.module.css";

export default function Home() {
  return (
<div className="flex flex-col items-center">
  <h1 className="text-3xl md:text-2xl  font-extrabold text-center mt-10 mb-6 tracking-wide text-slate-100 text-[#C99842]">
    Welcome to Board War — a strategic board game experience.</h1>
  <div className={styles.center}>
    <Image
      className={styles.logo}
      src="/logo.png"
      alt="Board War Logo"
      width={400}
      height={400}
      priority
    />
  </div>


</div>
  );
}
