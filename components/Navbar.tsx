'use client';
import { motion } from 'framer-motion';
import styles from './Navbar.module.css';

export default function Navbar() {
  return (
    <motion.nav 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className={styles.navbar}
    >
      <div className="container" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
        <div className={styles.logo}>
          NOMADX<span className={styles.logoE}>E</span>
        </div>
        <div className={styles.navLinks}>
          <a href="#how-it-works" className={styles.navLink}>How It Works</a>
          <a href="#options" className={styles.navLink}>Options</a>
          <a href="#use-cases" className={styles.navLink}>Use Cases</a>
        </div>
      </div>
    </motion.nav>
  );
}
