export interface PageSections {
  title?: string;
  choices: SupportType[];
  style?: 'small';
}

export interface QuestionSection {
  // Keep title as the stable form/session and support API field; label is display-only.
  title: string;
  label: string;
  help?: string;
}

export interface SupportPage {
  type?: undefined;
  id: string;
  title: string;
  shortHelp: string;
  repoHelp?: string;
  prologue?: string;
  epilogue?: string;
  sections: QuestionSection[];
  privateTicket?: boolean;
  ghIssuePreset?: string;
  includeDebugData?: boolean;
  repositories?: { repo: string, name: string }[];
}

export interface ExternalLink {
  type: 'link',
  url: string;
  title: string;
  shortHelp: string;
}

export type SupportType = SupportPage | ExternalLink;

export const supportTypes: PageSections[] = [
  {
    title: $localize`:@@support.page.e89b30aa1dc3:Resources`,
    choices: [
      {
        type: 'link',
        title: $localize`:@@support.page.36200ff83c37:📘 Portmaster Wiki & FAQ`,
        url: 'https://wiki.safing.io/?source=Portmaster',
        shortHelp: $localize`:@@support.page.e941250dfa2f:Search the Portmaster knowledge base and FAQ.`,
      },
      {
        type: 'link',
        title: $localize`:@@support.page.678df871025d:🔖 Settings Handbook`,
        url: 'https://docs.safing.io/portmaster/settings?source=Portmaster',
        shortHelp: $localize`:@@support.page.ca43623c704b:A reference document of all Portmaster settings.`
      },
      {
        type: 'link',
        title: $localize`:@@support.page.c4abbd60cb53:📑 Safing Blog`,
        url: 'https://safing.io/blog?source=Portmaster',
        shortHelp: $localize`:@@support.page.eafca62d7687:Read our blog posts and announcements.`,
      }
    ]
  },
  {
    title: $localize`:@@support.page.c13d2fc60195:Communities & Support`,
    style: 'small',
    choices: [
      {
        type: 'link',
        title: $localize`:@@support.page.72a14b2c3974:Join us on Discord`,
        url: 'https://safing.io/discord',
        shortHelp: $localize`:@@support.page.db4999a751b5:Get help from the community and our AI bot on Discord.`
      },
      {
        type: 'link',
        title: $localize`:@@support.page.9124f38580be:Follow us on Mastodon`,
        url: 'https://fosstodon.org/@safing',
        shortHelp: $localize`:@@support.page.9b2a2b772418:Get updates and privacy jokes on Mastodon.`
      },
      {
        type: 'link',
        title: $localize`:@@support.page.5e9c0dc295e1:Follow us on Twitter`,
        url: 'https://twitter.com/SafingIO',
        shortHelp: $localize`:@@support.page.af22ea32703a:Get updates and privacy jokes on Twitter.`
      },
      {
        type: 'link',
        title: $localize`:@@support.page.4e9ca97c7342:Safing Support via Email`,
        url: 'mailto:support@safing.io',
        shortHelp: $localize`:@@support.page.9a367f7dddb8:As a subscriber, reach out to the Safing team directly.`
      }
    ]
  },
  {
    title: $localize`:@@support.page.f5105f564caf:Make a Report`,
    style: 'small',
    choices: [
      {
        id: "report-bug",
        title: $localize`:@@support.page.737e9b37de7d:🐞 Report a Bug`,
        shortHelp: $localize`:@@support.page.840faad6f922:Found a bug? Report your discovery and make the Portmaster better for everyone.`,
        repoHelp: $localize`:@@support.page.e3e05d6ab65f:Where did the bug take place?`,
        sections: [
          {
            title: "What happened?",
            label: $localize`:@@support.page.c4dc542b511f:What happened?`,
            help: $localize`:@@support.page.26cdbd8606a2:Describe what happened in detail`
          },
          {
            title: "What did you expect to happen?",
            label: $localize`:@@support.page.ba413e076854:What did you expect to happen?`,
            help: $localize`:@@support.page.2f9b3431f216:Describe what you expected to happen instead`
          },
          {
            title: "How did you reproduce it?",
            label: $localize`:@@support.page.7fbe788f0db2:How did you reproduce it?`,
            help: $localize`:@@support.page.6a43130a7a78:Describe how to reproduce the issue`
          },
          {
            title: "Additional information",
            label: $localize`:@@support.page.a42f24143514:Additional information`,
            help: $localize`:@@support.page.815e5f251924:Provide extra details if needed`
          },
        ],
        includeDebugData: true,
        privateTicket: true,
        ghIssuePreset: "report-bug.md",
        repositories: []
      },
      {
        id: "give-feedback",
        title: $localize`:@@support.page.98e5fb600ea7:💡 Suggest an Improvement`,
        shortHelp: $localize`:@@support.page.4fcce3ecb503:Suggest an enhancement or a new feature for Portmaster.`,
        repoHelp: $localize`:@@support.page.fbff7040765a:What would you would like to improve?`,
        sections: [
          {
            title: "What would you like to add or change?",
            label: $localize`:@@support.page.f1f28158676c:What would you like to add or change?`,
          },
          {
            title: "Why do you and others need this?",
            label: $localize`:@@support.page.e1efc12b1157:Why do you and others need this?`
          }
        ],
        includeDebugData: false,
        privateTicket: true,
        ghIssuePreset: "suggest-feature.md",
        repositories: []
      },
      {
        id: "compatibility-report",
        title: $localize`:@@support.page.f0699578ba1f:📝 Make a Compatibility Report`,
        shortHelp: $localize`:@@support.page.d315e0aa9dfc:Report Portmaster in/compatibility with Linux Distros, VPN Clients or general Software.`,
        sections: [
          {
            title: "What worked?",
            label: $localize`:@@support.page.d9418c73cd08:What worked?`,
            help: $localize`:@@support.page.7ae560b8f4ab:Describe what worked`
          },
          {
            title: "What did not work?",
            label: $localize`:@@support.page.389a440f74bf:What did not work?`,
            help: $localize`:@@support.page.df9dcc4e8487:Describe what did not work in detail`
          },
          {
            title: "Additional information",
            label: $localize`:@@support.page.a42f24143514:Additional information`,
            help: $localize`:@@support.page.815e5f251924:Provide extra details if needed`
          },
        ],
        includeDebugData: true,
        privateTicket: true,
        ghIssuePreset: "report-compatibility.md",
        repositories: [] // not needed with the default being "portmaster"
      },
    ],
  }
]
