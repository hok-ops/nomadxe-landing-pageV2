'use client';
import { motion } from 'framer-motion';
import styles from './UseCases.module.css';

export default function UseCases() {
  const cases = [
    {
      title: 'Infrastructure & Energy',
      description: 'Secure remote substations, laydown yards, and solar arrays where power and network connectivity are scarce.'
    },
    {
      title: 'Temporary Construction',
      description: 'Monitor subcontractor progress and deter material theft during the highly vulnerable structural phases of a build.'
    },
    {
      title: 'Rapid Incident Management',
      description: 'Establish temporary, high-vantage situational awareness for event crowd control or urgent security gaps.'
    },
    {
      title: 'Compliance & Evidence',
      description: 'Maintain undeniable visual records to support safety compliance and protect your business against liability claims.'
    }
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.2 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
  };

  return (
    <section className={styles.section}>
      <div className="container">
        <div className={styles.header}>
          <h2 className={styles.headline}>Designed for High-Stakes Environments</h2>
        </div>
        <motion.div 
          className={styles.grid}
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          {cases.map((idxCase, idx) => (
             <motion.div key={idx} variants={itemVariants} className={styles.card}>
               <h3 className={styles.cardTitle}>{idxCase.title}</h3>
               <p className={styles.cardCopy}>{idxCase.description}</p>
             </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
