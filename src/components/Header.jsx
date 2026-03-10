import logo from '../assets/logo.png'

export default function Header() {
  return (
    <header className="header">
      <h1 className="header-logo-wrap">
        <img src={logo} alt="Noa Saitoshii" className="header-logo" />
      </h1>
      <p className="header-tagline">DJ &middot; Producer &middot; Streamer</p>
    </header>
  )
}
