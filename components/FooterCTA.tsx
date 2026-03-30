'use client';
import { motion } from 'framer-motion';
import styles from './FooterCTA.module.css';

export default function FooterCTA() {
  return (
    <section className={styles.section}>
      <div className="container">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className={styles.content}
        >
          <h2 className={styles.headline}>Ready to Secure Your Site?</h2>
          <p className={styles.bodyCopy}>Let's discuss your security challenges and architect a mobile visibility solution that works for you.</p>
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={styles.ctaButton}
          >
            Schedule a Consultation
          </motion.button>
        </motion.div>
      </div>
    </section>
  );
}
