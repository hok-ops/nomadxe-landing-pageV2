'use client';
import { motion } from 'framer-motion';
import styles from './MonitoringPartners.module.css';

export default function MonitoringPartners() {
  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <motion.div 
          initial={{ opacity: 0, x: -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className={styles.content}
        >
          <h2 className={styles.headline}>A Consultative Partnership Ecosystem</h2>
          <p className={styles.bodyCopy}>
            If you require active oversight but aren't sure where to begin, we can help. We work alongside a network of trusted monitoring professionals. Taking a consultative approach, we aim to understand your specific challenges and pair you with the right monitoring partner—ensuring incident response and situational awareness are handled by experts who fit your operational needs.
          </p>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, x: 50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className={styles.visual}
        >
          <div className={styles.screenMockup}>
            <div className={styles.dashboardGraphic}>
              <motion.div 
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 3, repeat: Infinity }}
                className={styles.dataPoint} style={{ top: '30%', left: '40%' }} 
              />
              <motion.div 
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 4, repeat: Infinity, delay: 1 }}
                className={styles.dataPoint} style={{ top: '60%', left: '70%' }} 
              />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
