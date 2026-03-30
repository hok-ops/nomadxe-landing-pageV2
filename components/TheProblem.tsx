'use client';
import { motion } from 'framer-motion';
import styles from './TheProblem.module.css';

export default function TheProblem() {
  return (
    <section className={styles.section}>
      <div className="container">
        <div className={styles.layout}>
          <motion.div 
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className={styles.content}
          >
            <h2 className={styles.headline}>The Gap in Traditional Site Security</h2>
            <p className={styles.bodyCopy}>
              Operating remote or temporary sites comes with inherent risk—from protecting valuable assets to navigating operational blind spots. Traditional security relies on power lines, physical infrastructure, and wired connectivity; resources that are often unavailable in the crucial early phases of a project. Without these, securing a site effectively becomes a complex logistical hurdle.
            </p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className={styles.visual}
          >
            <div className={styles.imagePlaceholder} />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
