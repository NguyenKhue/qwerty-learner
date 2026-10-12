import Layout from '../../components/Layout'
import ezbdc from '@/assets/friendlinks/ezbdc.jpg'
import kk from '@/assets/friendlinks/kk.jpg'
import web_worker from '@/assets/friendlinks/web-worker.png'
import type React from 'react'

export const FriendLinks: React.FC = () => {
  const links = [
    {
      title: 'ez背单词',
      href: 'https://ezbdc.dashu.ai',
      imgSrc: ezbdc,
      description:
        'A minimal English vocabulary learning app for convenient and efficient study, with a challenging word-memorization mode. No sign-up required, download and start using',
    },
    {
      title: 'Kai',
      href: 'https://kaiyi.cool/',
      imgSrc: kk,
      description: "Kai's personal blog, featuring tech articles, life reflections, and a few fun side projects",
    },
    {
      title: 'Web Worker - A Show Front-End Programmers Love',
      href: 'https://www.xiaoyuzhoufm.com/podcast/613753ef23c82a9a1ccfdf35',
      imgSrc: web_worker,
      description:
        'Web Worker is a Chinese-language audio podcast where a few front-end developers chat casually. The show rambles around everything developer-related: industry news, workplace topics, tech choices... anything and everything web development related is fair game.',
    },
  ]

  return (
    <Layout>
      <div className="flex w-full flex-1 flex-col items-center px-4 pt-20">
        <div className="flex w-full max-w-md flex-grow flex-col items-center">
          <div className="mt-5 text-center text-lg font-bold">Friendly Links</div>
          <div className="links flex w-full flex-col items-center gap-y-8 py-5">
            {links.map((link, index) => (
              <a
                key={index}
                title={link.title}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="linkItem flex w-full items-center overflow-hidden"
              >
                <div className="mr-3 flex h-8 w-8 flex-shrink-0 items-center justify-center bg-muted">
                  <img src={link.imgSrc} alt={link.title} className="h-full w-full object-cover" />
                </div>
                <div className="flex-1">
                  <div className="pb-1 text-sm font-bold">{link.title}</div>
                  <div className="text-xs text-muted-foreground">{link.description}</div>
                </div>
              </a>
            ))}
          </div>
        </div>
        <div className="mt-auto pb-5 text-center text-sm text-muted-foreground">
          Want to add your link? Email us:
          <a href="mailto:me@kaiyi.cool" className="text-blue-500">
            me@kaiyi.cool
          </a>
        </div>
      </div>
    </Layout>
  )
}
