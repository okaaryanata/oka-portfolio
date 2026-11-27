import type { ReactNode } from 'react';
import { Layout } from '../shared/ui/Layout';
import { Maze } from '../features/maze/Maze';
import { Queens } from '../features/queens/Queens';
import { Booking } from '../features/booking/Booking';
import { Sudoku } from '../features/sudoku/Sudoku';
import { CatViewer } from '../features/cats/CatViewer';
import { ChatDemo } from '../features/chat/ui/ChatDemo';
function Demo({
  id,
  category,
  title,
  description,
  children,
}: {
  id: string;
  category: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="section" id={id}>
      <div className="demo-heading">
        <div>
          <p className="eyebrow">{category}</p>
          <h2>{title}</h2>
        </div>
        <p>{description}</p>
      </div>
      {children}
    </section>
  );
}
export function Projects() {
  return (
    <Layout demos>
      <main className="wrap demos" id="main">
        <div className="demo-intro">
          <a href="index.html#projects">Back to portfolio</a>
          <p className="location">Personal Projects · Interactive demos</p>
          <h1>
            Small problems.
            <br />
            Visible solutions.
          </h1>
          <p className="intro">
            Explore algorithms, solve a Sudoku, browse cat GIFs, or try a live conversation between
            two accounts.
          </p>
        </div>
        <Demo
          id="maze-section"
          category="Graph search"
          title="Maze & Pathfinding"
          description="Compare breadth-first search with A* on the same grid. Both find a shortest route; A* uses distance to the finish to guide its search."
        >
          <Maze />
        </Demo>
        <Demo
          id="queens-section"
          category="Backtracking"
          title="N-Queens"
          description="Place one queen in every row without sharing a column or diagonal. Watch the solver undo placements when a choice leads to a dead end."
        >
          <Queens />
        </Demo>
        <Demo
          id="booking-section"
          category="Concurrency concept"
          title="One slot. Two requests."
          description="Two customers want the same 10:00 slot. Change their arrival delays and see which request claims it first."
        >
          <Booking />
        </Demo>
        <Demo
          id="sudoku-section"
          category="Constraint solving"
          title="Sudoku Solver"
          description="Edit the clues, then let the Go backend solve the puzzle. Empty cells represent unknown digits."
        >
          <Sudoku />
        </Demo>
        <Demo
          id="cats-section"
          category="Just for fun"
          title="Cat GIFs"
          description="A fresh GIF from CATAAS, fetched through the Go API. Animation starts only when you ask for it."
        >
          <CatViewer />
        </Demo>
        <Demo
          id="chat-section"
          category="Real-time messaging"
          title="Two accounts. One conversation."
          description="Try both sides of a live conversation. Each pane has a separate account session connected to the Go backend over WebSockets."
        >
          <ChatDemo />
        </Demo>
      </main>
    </Layout>
  );
}
