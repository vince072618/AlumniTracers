import React, { useState, useEffect } from 'react';
import Header from '../Layout/Header';
import Sidebar from '../Layout/Sidebar';
import AlumniProfile from '../Profile/AlumniProfile';
import PasswordChangeForm from '../Profile/PasswordChangeForm';

const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('profile');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile menu when screen size changes to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleMobileMenuToggle = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleMobileMenuClose = () => {
    setIsMobileMenuOpen(false);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'profile':
        return <AlumniProfile />;
      case 'password':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Change Password</h2>
            <PasswordChangeForm onSuccess={() => setActiveTab('profile')} />
          </div>
        );
      default:
        return <AlumniProfile />;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Header onMobileMenuToggle={handleMobileMenuToggle} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar 
          activeTab={activeTab} 
          onTabChange={setActiveTab}
          isMobileMenuOpen={isMobileMenuOpen}
          onMobileMenuClose={handleMobileMenuClose}
        />
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
