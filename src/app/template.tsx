/** Шаблон пересоздаётся при каждом переходе, поэтому страница плавно появляется */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
