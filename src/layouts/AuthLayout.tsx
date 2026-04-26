import { motion } from "framer-motion";
import { Outlet } from "react-router-dom";
import logoIcon from "../assets/logo.png";

export function AuthLayout() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[linear-gradient(180deg,_white_0%,_var(--color-apple-gray)_52%,_var(--color-primary-muted)_100%)] px-4 py-8 sm:px-6">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-16 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary-light/25 blur-2xl" />
        <div className="absolute bottom-[-5rem] right-[-4rem] h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 flex w-full max-w-md flex-col items-center"
      >
        <div className="mb-3 flex h-24 w-72 items-center justify-center sm:h-28 sm:w-80">
          <img
            src={logoIcon}
            alt="Rastro Florestal"
            className="h-full w-full object-contain object-center"
          />
        </div>

        <div className="w-full rounded-[28px] border border-white/70 bg-white/92 p-6 shadow-2xl shadow-primary/15 backdrop-blur-sm sm:p-8">
          <div className="mb-6 h-1.5 w-20 rounded-full bg-gradient-to-r from-primary-dark via-primary to-primary-light" />
          <div>
            <Outlet />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
