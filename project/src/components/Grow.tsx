import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { TrendingUp, Award } from 'lucide-react';

interface Skill {
  name: string;
  level: string;
  category: string;
}

interface Exchange {
  _id: string;
  skill: string;
  progress: number;
  status: 'pending' | 'active' | 'completed';
}

interface SkillProgress {
  skill: Skill;
  progress: number;
  rating: number;
  completedExchanges: number;
}

export default function Grow() {
  const { user } = useAuth();
  const [skillProgress, setSkillProgress] = useState<SkillProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExchanges = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/exchanges', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch exchanges');
      }

      const exchanges: Exchange[] = await response.json();

      // Process user skills with actual progress from exchanges
      if (user?.skills) {
        console.log('User skills:', user.skills);
        const formattedProgress = user.skills.map((skill: string | { name?: string; level?: string; category?: string }) => {
          // Handle both string and object formats for skills
          const formattedSkill: Skill = {
            name: typeof skill === 'string' ? skill : skill.name || 'Unknown Skill',
            level: typeof skill === 'object' ? skill.level || 'intermediate' : 'intermediate',
            category: typeof skill === 'object' ? skill.category || 'other' : 'other'
          };

          // Find all exchanges for this skill
          const skillExchanges = exchanges.filter(ex => 
            ex.skill.toLowerCase() === formattedSkill.name.toLowerCase()
          );

          // Calculate average progress from active and completed exchanges
          const relevantExchanges = skillExchanges.filter(ex => 
            ex.status === 'active' || ex.status === 'completed'
          );
          
          const averageProgress = relevantExchanges.length > 0
            ? Math.round(
                relevantExchanges.reduce((sum, ex) => sum + ex.progress, 0) / 
                relevantExchanges.length
              )
            : 0;

          // Count completed exchanges
          const completedCount = skillExchanges.filter(ex => 
            ex.status === 'completed'
          ).length;

          // Calculate rating based on completed exchanges and progress
          const rating = Math.min(
            5,
            ((completedCount * 0.7) + (averageProgress / 100 * 0.3)) * 5
          );

          return {
            skill: formattedSkill,
            progress: averageProgress,
            rating: Number(rating.toFixed(1)),
            completedExchanges: completedCount
          };
        });

        setSkillProgress(formattedProgress);
        console.log('Formatted progress:', formattedProgress);
      } else {
        console.log('No user skills found');
      }
    } catch (err) {
      console.error('Error fetching exchanges:', err);
      setError('Failed to load skill progress. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExchanges();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center mb-8">
          <TrendingUp className="h-8 w-8 text-indigo-600 mr-3" />
          <h1 className="text-2xl font-bold text-gray-900">Your Growth</h1>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
            {error}
          </div>
        )}

        <div className="grid gap-6">
          {skillProgress.map((item, index) => (
            <div key={index} className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{item.skill.name}</h2>
                  <p className="text-sm text-gray-500">
                    Level: {item.skill.level.charAt(0).toUpperCase() + item.skill.level.slice(1)}
                  </p>
                  <p className="text-sm text-gray-500">
                    Category: {item.skill.category.charAt(0).toUpperCase() + item.skill.category.slice(1)}
                  </p>
                </div>
                <div className="flex items-center">
                  <Award className="h-5 w-5 text-yellow-500 mr-1" />
                  <span className="text-gray-600">{item.rating}/5.0</span>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>Progress</span>
                  <span>{item.progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${item.progress}%` }}
                  ></div>
                </div>
              </div>

              <div className="text-sm text-gray-600">
                Completed Exchanges: {item.completedExchanges}
              </div>

              {item.completedExchanges > 0 && (
                <div className="mt-4 border-t pt-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-2">Update Progress</h3>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={item.progress}
                      onChange={async (e) => {
                        const newProgress = parseInt(e.target.value);
                        try {
                          // Find the active exchange for this skill
                          const response = await fetch('http://localhost:5001/api/exchanges', {
                            headers: {
                              'Authorization': `Bearer ${localStorage.getItem('token')}`,
                            },
                          });

                          if (!response.ok) {
                            throw new Error('Failed to fetch exchanges');
                          }

                          const exchanges: Exchange[] = await response.json();
                          const activeExchange = exchanges.find(
                            ex => ex.skill.toLowerCase() === item.skill.name.toLowerCase() && 
                                 ex.status === 'active'
                          );

                          if (!activeExchange) {
                            throw new Error('No active exchange found for this skill');
                          }

                          // Update the progress for the active exchange
                          const updateResponse = await fetch(`http://localhost:5001/api/exchanges/${activeExchange._id}/update`, {
                            method: 'PATCH',
                            headers: {
                              'Authorization': `Bearer ${localStorage.getItem('token')}`,
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ progress: newProgress })
                          });

                          if (!updateResponse.ok) {
                            throw new Error('Failed to update progress');
                          }

                          // Refresh exchanges after update
                          fetchExchanges();
                        } catch (error) {
                          console.error('Error updating progress:', error);
                          setError('Failed to update progress. Please try again.');
                        }
                      }}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-sm text-gray-600 min-w-[3ch]">{item.progress}%</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {skillProgress.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600">No skills to track yet. Start exchanging to see your progress!</p>
          </div>
        )}
      </div>
    </div>
  );
} 