'use client';
import { motion } from 'framer-motion';
import styles from './Hero.module.css';

export default function Hero() {
  return (
    <section className={styles.hero}>
      <div className={styles.background}></div>
      <div className="container">
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.8 }}
          className={styles.content}
        >
          <h1 className={styles.headline}>Mobile Visibility, Wherever You Need It.</h1>
          <p className={styles.subheadline}>
            Gain capable, highly adaptable security and monitoring for your remote sites. Built to work precisely with your existing infrastructure, when it matters most.
          </p>
          <button className={styles.ctaButton}>Explore Our Solutions</button>
        </motion.div>
      </div>
    </section>
  );
}
