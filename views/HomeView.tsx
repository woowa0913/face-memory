import React, { useState } from 'react';
import { Person } from '../types';
import { getLearningStats, getDuePeople } from '../services/srs';
import { PersonCard } from '../components/PersonCard';
import { Icons } from '../components/Icon';
import { ProfileModal } from '../components/ProfileModal';

interface HomeViewProps {
  people: Person[];
  onStartQuiz: () => void;
  onRefresh?: () => void; // Callback to refresh parent data
}

export const HomeView: React.FC<HomeViewProps> = ({ people, onStartQuiz, onRefresh }) => {
  const stats = getLearningStats(people);
  const due = getDuePeople(people);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);

  const handleProfileUpdate = () => {
    if (onRefresh) onRefresh();
  };

  return (
    <div className="p-6">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">안녕하세요, 담당자님!</h1>
        <p className="text-gray-500">오늘도 팀원들 얼굴을 익혀볼까요?</p>
      </header>

      {/* Stats Card */}
      <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-6 text-white shadow-lg mb-8">
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-indigo-100 text-sm font-medium">오늘의 복습 대상</p>
            <h2 className="text-4xl font-bold mt-1">{due.length}명</h2>
          </div>
          <div className="bg-white/20 p-2 rounded-lg">
            <Icons.Brain size={24} className="text-white" />
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/10">
          <div>
            <p className="text-xs text-indigo-200">전체</p>
            <p className="font-semibold text-lg">{stats.total}</p>
          </div>
          <div>
            <p className="text-xs text-indigo-200">마스터</p>
            <p className="font-semibold text-lg">{stats.mastered}</p>
          </div>
          <div>
            <p className="text-xs text-indigo-200">신규</p>
            <p className="font-semibold text-lg">{stats.newItems}</p>
          </div>
        </div>
      </div>

      {/* Action */}
      {people.length > 0 && (due.length > 0 || stats.newItems > 0) ? (
        <button
          onClick={onStartQuiz}
          className="w-full bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold py-4 px-6 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 mb-8"
        >
          <Icons.Brain size={20} />
          학습 시작하기 ({Math.min(due.length + 5, people.length)}명)
        </button>
      ) : people.length > 0 ? (
        <div className="text-center p-6 bg-green-50 rounded-xl mb-8 border border-green-100">
          <Icons.Check className="w-8 h-8 text-green-500 mx-auto mb-2" />
          <p className="text-green-800 font-medium">오늘은 모두 학습했습니다!</p>
        </div>
      ) : (
        <div className="text-center p-6 bg-gray-100 rounded-xl mb-8 border border-gray-200">
             <p className="text-gray-500">등록된 인원이 없습니다.<br/>'사진 추가' 탭에서 사진을 올려주세요.</p>
        </div>
      )}

      {/* List */}
      <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center justify-between">
        <span>팀원 목록</span>
        <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{people.length} 명</span>
      </h3>
      
      <div className="space-y-3 pb-20">
        {people.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <p>데이터가 없습니다.</p>
            <p className="text-sm">사진을 업로드하여 퀴즈를 생성하세요.</p>
          </div>
        ) : (
          people.map(p => (
            <PersonCard 
              key={p.id} 
              person={p} 
              onClick={() => setSelectedPerson(p)} 
            />
          ))
        )}
      </div>

      {/* Detail Modal */}
      {selectedPerson && (
        <ProfileModal 
          person={selectedPerson} 
          onClose={() => setSelectedPerson(null)}
          onUpdate={handleProfileUpdate}
        />
      )}
    </div>
  );
};