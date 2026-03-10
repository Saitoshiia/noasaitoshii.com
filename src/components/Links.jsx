import {
  FaTwitch,
  FaSoundcloud,
  FaYoutube,
  FaXTwitter,
  FaBluesky,
  FaInstagram,
  FaTiktok,
  FaDiscord,
} from 'react-icons/fa6'
import { SiKofi } from 'react-icons/si'

const FEATURED = [
  { label: 'Twitch', url: 'https://www.twitch.tv/noasaitoshii', Icon: FaTwitch },
  { label: 'Twitch (Alt)', url: 'https://www.twitch.tv/noasaii', Icon: FaTwitch },
]

const LINKS = [
  { label: 'Twitter / X', url: 'https://twitter.com/noasaitoshii', Icon: FaXTwitter },
  { label: 'Bluesky', url: 'https://bsky.app/profile/noasaitoshii.bsky.social', Icon: FaBluesky },
  { label: 'YouTube', url: 'https://www.youtube.com/@noasaitoshii', Icon: FaYoutube },
  { label: 'Instagram', url: 'https://www.instagram.com/noasaitoshii', Icon: FaInstagram },
  { label: 'Soundcloud', url: 'https://soundcloud.com/noasaitoshii', Icon: FaSoundcloud },
  { label: 'Discord', url: 'https://discord.gg/saitoshiia', Icon: FaDiscord },
  { label: 'Ko-fi', url: 'https://ko-fi.com/noasaitoshii', Icon: SiKofi },
  { label: 'TikTok', url: 'https://www.tiktok.com/@noasaitoshii', Icon: FaTiktok },
]

function LinkCard({ label, url, Icon, featured = false }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`link-card${featured ? ' featured' : ''}`}
    >
      <Icon className="link-icon" />
      <span className="link-label">{label}</span>
    </a>
  )
}

export default function Links() {
  return (
    <section>
      <p className="section-label">Links</p>
      <div className="links-featured">
        {FEATURED.map(link => (
          <LinkCard key={link.label} {...link} featured />
        ))}
      </div>
      <div className="links-grid">
        {LINKS.map(link => (
          <LinkCard key={link.label} {...link} />
        ))}
      </div>
    </section>
  )
}
