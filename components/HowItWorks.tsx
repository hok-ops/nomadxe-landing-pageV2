'use client';
import { motion } from 'framer-motion';
import styles from './HowItWorks.module.css';

export default function HowItWorks() {
  return (
    <section className={styles.section}>
      <div className="container">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className={styles.header}
        >
          <h2 className={styles.headline}>Capability Driven by Flexibility</h2>
          <p className={styles.bodyCopy}>
            We provide the robust foundation you need to secure your operations. Rather than forcing a rigid system onto your site, our mobile camera platforms are designed to adapt to your environment, your partners, and your timeline. It is about delivering outcome-focused visibility, configured exactly for the challenges you face today.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
