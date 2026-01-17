import React, { useState, useEffect } from 'react';
import { NavBar } from './components/NavBar';
import { Person } from './types';
import { dbService } from './services/db';
import { HomeView } from './views/HomeView';
import { QuizView } from './views/QuizView';
import { AddPeopleView } from './views/AddPeopleView';

export default function App() {
  const [currentView, setCurrentView] = useState<'home' | 'learn' | 'manage'>('home');
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshData = async () => {
    try {
      const allPeople = await dbService.getAllPeople();
      setPeople(allPeople);
    } catch (error) {
      console.error("Failed to load DB", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, [currentView]); // Refresh when view changes

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-50 text-indigo-600">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-20">
      <main className="max-w-md mx-auto min-h-screen bg-white shadow-2xl overflow-hidden relative">
        {currentView === 'home' && (
          <HomeView people={people} onStartQuiz={() => setCurrentView('learn')} onRefresh={refreshData} />
        )}
        {currentView === 'learn' && (
          <QuizView people={people} onExit={() => setCurrentView('home')} />
        )}
        {currentView === 'manage' && (
          <AddPeopleView onFinish={() => setCurrentView('home')} />
        )}
      </main>
      <NavBar currentView={currentView} setView={setCurrentView} />
    </div>
  );
}