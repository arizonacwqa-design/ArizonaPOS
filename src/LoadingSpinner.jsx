const LoadingSpinner = ({ message = "Loading..." }) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-950">
    <div className="text-center">
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-blue-500 mx-auto mb-3"></div>
      <p className="text-gray-400 text-sm">{message}</p>
    </div>
  </div>
);

export default LoadingSpinner;
