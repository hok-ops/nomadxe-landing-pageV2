'use client';
import { motion } from 'framer-motion';
import styles from './TwoOptions.module.css';

export default function TwoOptions() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.3 }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, rotateY: 30, y: 50 },
    visible: { opacity: 1, rotateY: 0, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
  };

  return (
    <section className={styles.section}>
      <div className="container">
        <div className={styles.header}>
          <h2 className={styles.headline}>Two Approaches. One Goal: Clear Visibility.</h2>
          <p className={styles.bodyCopy}>We recognize there is no single solution for complex organizations. That’s why we offer two distinct pathways to secure your site, built around your specific requirements.</p>
        </div>
        
        <motion.div 
          className={styles.grid}
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          <motion.div variants={cardVariants} className={styles.card}>
            <h3 className={styles.cardTitle}>Option 1: Bring Your Own Setup</h3>
            <p className={styles.cardCopy}>
               You have the cameras. You have the preferred software. You simply need a reliable, deployable base to run it from. We provide the power, the networking, and the physical platform. You install your equipment and tie it seamlessly into your existing ecosystem.
            </p>
          </motion.div>
          <motion.div variants={cardVariants} className={styles.card}>
            <h3 className={styles.cardTitle}>Option 2: Fully Equipped & Ready</h3>
            <p className={styles.cardCopy}>
              You need immediate visibility without the integration workload. We supply the platform fully equipped with advanced cameras and connected directly to a preferred monitoring service. It arrives out-of-the-box, ready to secure your site from day one.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
