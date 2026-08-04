"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export default function AdminNavCard({
  href,
  title,
  description,
  index = 0,
}: {
  href: string;
  title: string;
  description: string;
  index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.06, ease: [0.4, 0, 0.2, 1] }}
    >
      <Link href={href} className="card block hover:bg-white/5">
        <h3 className="font-semibold text-white">{title}</h3>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </Link>
    </motion.div>
  );
}
