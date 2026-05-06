import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MANUAL_CONTENT } from '@/docs/manual_content';
import { HelpCircle, BookOpen, Info } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function ManualSidebar({ open, onOpenChange, user }) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  
  const isAdmin = user?.role === 'admin';

  // Encontrar a seção relevante ou mostrar a geral
  const sections = Object.keys(MANUAL_CONTENT).filter(path => {
    // Filtrar seções baseadas no acesso do utilizador
    if (path === '/utilizadores' || path === '/configuracoes') {
      return isAdmin;
    }
    return true;
  });

  const rawSection = MANUAL_CONTENT[currentPath] || MANUAL_CONTENT['geral'];
  
  // Se o utilizador tentar ver ajuda de uma página que não tem acesso, mostra a geral
  const finalRawSection = (currentPath === '/utilizadores' || currentPath === '/configuracoes') && !isAdmin
    ? MANUAL_CONTENT['geral']
    : rawSection;
  
  // Limpar a indentação do conteúdo para evitar que o Markdown interprete como blocos de código
  const cleanContent = (text) => {
    return text
      .split('\n')
      .map(line => line.replace(/^\s+/, '')) // Remove espaços no início de cada linha
      .join('\n')
      .trim();
  };

  const currentSection = {
    ...finalRawSection,
    content: cleanContent(finalRawSection.content)
  };

  const otherSections = sections.filter(s => s !== currentPath && s !== 'geral');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl w-[95vw] p-0 flex flex-col border-l shadow-2xl">
        <SheetHeader className="p-6 border-b bg-primary/5">
          <div className="flex items-center gap-2 text-primary">
            <BookOpen className="w-5 h-5" />
            <SheetTitle>Centro de Ajuda</SheetTitle>
          </div>
          <SheetDescription>
            Guia de utilização e procedimentos do sistema.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-8 pb-12">
            {/* Seção Atual (Contexto) */}
            <section className="animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="flex items-center gap-2 mb-3 text-primary font-bold uppercase text-[10px] tracking-widest">
                <Info className="w-3 h-3" />
                <span>Contexto Atual</span>
              </div>
              <h2 className="text-xl font-bold mb-4 text-foreground leading-tight">{currentSection.title}</h2>
              
              <div className="space-y-4 text-sm text-muted-foreground w-full overflow-hidden">
                <ReactMarkdown
                  components={{
                    h3: ({node, ...props}) => <h3 className="text-sm font-bold text-foreground mt-6 mb-2 uppercase tracking-tight block w-full break-words" {...props} />,
                    ul: ({node, ...props}) => <ul className="space-y-3 my-3 list-none p-0 m-0 w-full" {...props} />,
                    li: ({node, ...props}) => (
                      <div className="flex gap-3 items-start w-full mb-1">
                        <div className="w-1 h-1 rounded-full bg-primary/60 mt-2 shrink-0" />
                        <span className="flex-1 leading-relaxed break-words text-muted-foreground" {...props} />
                      </div>
                    ),
                    p: ({node, ...props}) => <p className="leading-relaxed break-words block w-full my-3" {...props} />,
                    strong: ({node, ...props}) => <strong className="font-bold text-foreground" {...props} />,
                    code: ({node, ...props}) => <span className="bg-muted px-1 rounded text-xs font-mono" {...props} />,
                    pre: ({node, ...props}) => <div className="whitespace-normal break-words" {...props} />,
                  }}
                >
                  {currentSection.content}
                </ReactMarkdown>
              </div>
            </section>

            {/* Outras Seções */}
            <div className="pt-6 border-t">
              <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-muted-foreground" />
                Outros tópicos de ajuda
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {['geral', ...otherSections].map(path => {
                  const section = MANUAL_CONTENT[path];
                  if (path === currentPath) return null;
                  return (
                    <button 
                      key={path} 
                      onClick={() => {
                        if (path === 'geral') {
                          // Se for geral, apenas mostramos o conteúdo sem navegar
                          // mas como a navegação ajuda a mudar o contexto, vamos navegar para a dashboard se estiver noutra página
                          navigate('/');
                        } else {
                          navigate(path);
                        }
                      }}
                      className="p-3 rounded-lg border bg-card hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer text-left w-full group"
                    >
                      <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                        {section.title}
                      </h4>
                      <div className="text-[11px] text-muted-foreground mt-1 leading-normal break-words whitespace-normal">
                         {section.content.split('\n').find(l => l.trim().length > 0 && !l.startsWith('#'))?.slice(0, 80) + '...'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
