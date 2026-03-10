import Header from './components/Header'
import About from './components/About'
import Links from './components/Links'
import Contact from './components/Contact'

export default function App() {
  return (
    <div className="page">
      <Header />
      <main className="main">
        <About />
        <Links />
        <Contact />
      </main>
      <footer className="footer">
        <p>© {new Date().getFullYear()} Noa Saitoshii</p>
      </footer>
    </div>
  )
}
