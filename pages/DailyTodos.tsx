import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api/client';
import {
  CalendarDays, Loader2, ChevronLeft, ChevronRight, CheckCircle2
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isToday, addMonths, subMonths } from 'date-fns';

const DailyTodos: React.FC = () => {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [todos, setTodos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMonthTodos = useCallback(async (month: Date) => {
    setLoading(true);
    try {
      const from = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
      const to = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
      const data = await apiClient.get(
        `/daily-todos?from=${from.toISOString()}&to=${to.toISOString()}`
      );
      setTodos(data);
    } catch (err) {
      console.error('Failed to fetch daily todos:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title = 'Calendar Month View | Idea-CRM';
    fetchMonthTodos(currentMonth);
  }, [currentMonth, fetchMonthTodos]);

  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const goToday = () => setCurrentMonth(startOfMonth(new Date()));

  // Get days to display in the grid
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const dateFormat = "d";
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const getTaskCounts = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const dayTodos = todos.filter(t => t.date && String(t.date).slice(0, 10) === dateKey && t.status !== 'Archived');
    
    let total = 0;
    let completed = 0;
    const count = (list: any[]) => {
      list.forEach(t => {
        total++;
        if (t.completed) completed++;
        if (t.children && t.children.length > 0) count(t.children);
      });
    };
    count(dayTodos);
    return { total, completed };
  };

  const handleDayClick = (day: Date) => {
    navigate(`/?date=${format(day, 'yyyy-MM-dd')}`);
  };

  return (
    <div className="max-w-6xl mx-auto py-10 px-6 animate-in fade-in duration-500 h-full flex flex-col">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
            <CalendarDays className="w-8 h-8 text-indigo-600" />
            Calendar
          </h1>
          <p className="text-gray-500 mt-1">Monthly overview of your tasks</p>
        </div>
        <div className="flex items-center bg-white rounded-xl shadow-sm border border-gray-200 p-1">
          <button onClick={prevMonth} className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="px-6 py-2 min-w-[200px] text-center font-black text-gray-800 tracking-wide">
            {format(currentMonth, 'MMMM yyyy')}
          </div>
          <button onClick={nextMonth} className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
          <button 
            onClick={goToday}
            className="ml-2 px-4 py-2 text-xs font-bold uppercase tracking-widest text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
          >
            Today
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-gray-200 shadow-sm overflow-hidden flex-1 flex flex-col relative">
        {loading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          </div>
        )}
        
        {/* Days of week header */}
        <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/50">
          {weekDays.map(day => (
            <div key={day} className="py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 grid grid-cols-7 grid-rows-5 auto-rows-fr bg-gray-100 gap-[1px]">
          {days.map((day, idx) => {
            const isCurrentMonth = isSameMonth(day, monthStart);
            const isCurrentDay = isToday(day);
            const { total, completed } = getTaskCounts(day);
            const hasTasks = total > 0;
            const allCompleted = hasTasks && total === completed;

            return (
              <div
                key={day.toString()}
                onClick={() => handleDayClick(day)}
                className={`
                  bg-white relative p-3 flex flex-col transition-all cursor-pointer group hover:bg-gray-50
                  ${!isCurrentMonth ? 'text-gray-400 opacity-50 bg-gray-50/50' : 'text-gray-900'}
                  ${isCurrentDay ? 'bg-indigo-50/30' : ''}
                `}
              >
                <div className="flex items-center justify-between">
                  <span className={`
                    w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold
                    ${isCurrentDay ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'group-hover:bg-gray-100'}
                  `}>
                    {format(day, dateFormat)}
                  </span>
                  {allCompleted && <CheckCircle2 className="w-4 h-4 text-green-500 opacity-50" />}
                </div>

                <div className="mt-auto pt-2 flex flex-col gap-1">
                  {hasTasks ? (
                    <>
                      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${allCompleted ? 'bg-green-500' : 'bg-indigo-500'}`}
                          style={{ width: `${(completed / total) * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-gray-400 flex items-center justify-between">
                        <span>{completed}/{total} tasks</span>
                        {allCompleted && <span className="text-green-600">Done</span>}
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DailyTodos;
