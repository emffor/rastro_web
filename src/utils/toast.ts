import { toast, type ToastOptions } from 'react-toastify';

const defaultOptions: ToastOptions = {
  position: 'top-right',
  autoClose: 5000,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  theme: 'light',
};

export const toastUtils = {
  success: (message: string, options?: Partial<ToastOptions>) => {
    return toast.success(message, { ...defaultOptions, ...options });
  },
  
  error: (message: string, options?: Partial<ToastOptions>) => {
    return toast.error(message, { ...defaultOptions, ...options });
  },
  
  warning: (message: string, options?: Partial<ToastOptions>) => {
    return toast.warning(message, { ...defaultOptions, ...options });
  },
  
  info: (message: string, options?: Partial<ToastOptions>) => {
    return toast.info(message, { ...defaultOptions, ...options });
  },
};
