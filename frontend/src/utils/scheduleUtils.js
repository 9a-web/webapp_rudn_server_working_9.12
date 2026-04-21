/**
 * Groups schedule items by discipline and time.
 * Useful for combining identical subjects (e.g. same time but different teachers/groups)
 * into a single display card.
 * 
 * @param {Array} scheduleItems - List of schedule items
 * @returns {Array} Grouped items with a 'subItems' array containing details for each original item
 */
export const groupScheduleItems = (scheduleItems) => {
  const groups = {};
  
  scheduleItems.forEach(item => {
    // Create unique key based on discipline and time
    const key = `${item.discipline?.trim()}-${item.time?.trim()}`;
    
    if (!groups[key]) {
      groups[key] = {
        ...item,
        subItems: [] // Array to store details of each sub-item
      };
    }
    
    // Add details (teacher, auditory) to subItems
    groups[key].subItems.push({
      teacher: item.teacher,
      auditory: item.auditory,
      raw: item
    });
  });
  
  return Object.values(groups);
};
