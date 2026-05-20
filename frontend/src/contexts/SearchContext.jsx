/**
 * SearchContext — глобальный context для поискового модала.
 *
 * Использование:
 *   1) Обернуть приложение в `<SearchProvider>`.
 *   2) В любом компоненте: `const { openSearch } = useSearch(); ...`
 *   3) `SearchProvider` сам рендерит `<GlobalSearchModal>` и слушает Cmd/Ctrl+K.
 */
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import GlobalSearchModal from '../components/GlobalSearchModal';

const SearchContext = createContext({
  isOpen: false,
  openSearch: () => {},
  closeSearch: () => {},
});

export const useSearch = () => useContext(SearchContext);

export const SearchProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [initialQuery, setInitialQuery] = useState('');

  const openSearch = useCallback((opts = {}) => {
    if (typeof opts === 'string') {
      setInitialQuery(opts);
    } else {
      setInitialQuery(opts?.query || '');
    }
    setIsOpen(true);
  }, []);

  const closeSearch = useCallback(() => {
    setIsOpen(false);
    // Чтобы initialQuery не зацепился при следующем открытии без opts:
    setInitialQuery('');
  }, []);

  // Cmd/Ctrl + K — глобальный shortcut. Игнорируется если фокус в input/textarea
  // или если уже открыт.
  useEffect(() => {
    const onKey = (e) => {
      const isCmdK = (e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K');
      if (!isCmdK) return;
      // Не блокируем обычный Ctrl-K в inputах внутри Telegram WebView, проверяем
      // что фокус не на полях ввода (тогда shortcut не должен срабатывать)
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      const isEditable =
        tag === 'input' ||
        tag === 'textarea' ||
        document.activeElement?.isContentEditable;
      if (isEditable && !isOpen) {
        // В поле — не открываем (даём вводить Ctrl+K если нужно)
        return;
      }
      e.preventDefault();
      if (isOpen) {
        setIsOpen(false);
      } else {
        setInitialQuery('');
        setIsOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  return (
    <SearchContext.Provider value={{ isOpen, openSearch, closeSearch }}>
      {children}
      <GlobalSearchModal
        isOpen={isOpen}
        onClose={closeSearch}
        initialQuery={initialQuery}
      />
    </SearchContext.Provider>
  );
};

export default SearchContext;
