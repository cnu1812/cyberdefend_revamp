const roles=[
  {
    "slug": "business-development-associate",
    "title": "Business Development Associate",
    "fullTitle": "Business Development Associate (BDA) — Marketing & Growth",
    "group": "experienced",
    "immediate": true,
    "tasks": [
      "Identify leads, nurture prospects, and convert interest into training or partnership opportunities.",
      "Support outreach campaigns, webinars, institutional collaborations, and sales follow-ups.",
      "Maintain CRM records, track campaign performance, and coordinate with marketing and training teams."
    ],
    "eligibility": "Experience: Open | Business development / marketing",
    "overview": "Drive awareness, partnerships, and enrollment growth for CyberDefend training and professional services.",
    "skills": "Communication, lead generation, relationship management, presentation skills, and comfort with LinkedIn, CRM, and digital marketing tools."
  },
  {
    "slug": "security-engineer",
    "title": "Security Engineer",
    "fullTitle": "Security Engineer — IR / TH / SIEM / SOAR / EDR / XDR / Email Security",
    "group": "experienced",
    "tasks": [
      "Lead incident triage, containment, root-cause analysis, and threat hunting across endpoint, identity, cloud, network, and email.",
      "Build and tune SIEM detection rules, dashboards, use cases, and SOAR playbooks; reduce false positives and improve response time.",
      "Work with leading platforms such as Microsoft Sentinel, Splunk, Google SecOps, CrowdStrike Falcon, Microsoft Defender XDR, Palo Alto Cortex XDR/XSOAR, and Proofpoint."
    ],
    "eligibility": "4–7 years | Experienced professional",
    "overview": "Investigate complex security incidents, hunt threats, develop detections, and automate response across enterprise environments.",
    "skills": "Hands-on incident response, MITRE ATT&CK, KQL/SPL, EDR/XDR investigations, phishing analysis, scripting, and clear technical reporting."
  },
  {
    "slug": "threat-researcher-intern",
    "title": "Threat Researcher Intern",
    "fullTitle": "Threat Researcher Intern",
    "group": "internships",
    "tasks": [
      "Track threat actors, campaigns, malware families, IOCs, and TTPs using reliable open-source intelligence.",
      "Map findings to MITRE ATT&CK; explore OWASP Top 10, web attacks, malware behavior, and vulnerability trends.",
      "Prepare concise threat briefs, detection ideas, and reproducible research notes in safe lab environments."
    ],
    "eligibility": "3rd- or 4th-year undergraduate student | Internship",
    "overview": "Research emerging threats and turn technical findings into practical intelligence, detections, and educational content.",
    "skills": "Interest in cybersecurity, basic networking/Linux/Python, analytical curiosity, and strong documentation skills."
  },
  {
    "slug": "servicenow-developer",
    "title": "ServiceNow Developer — ITSM",
    "fullTitle": "ServiceNow Developer — ITSM",
    "group": "experienced",
    "tasks": [
      "Configure Incident, Problem, Change, Request, Service Catalog, and knowledge management processes.",
      "Develop Business Rules, Client Scripts, Script Includes, UI Policies, Flow Designer automations, and integrations.",
      "Maintain platform quality through testing, troubleshooting, access controls, and release practices."
    ],
    "eligibility": "3–5 years | Experienced professional",
    "overview": "Design, customize, and maintain ServiceNow ITSM workflows that improve service delivery and operational efficiency.",
    "skills": "ServiceNow ITSM experience, JavaScript, Glide APIs, REST integrations, ACLs, and practical understanding of ITIL."
  },
  {
    "slug": "security-engineer-instructor",
    "title": "Security Engineer Instructor",
    "fullTitle": "Professional Security Engineer Instructor — Freelance",
    "group": "freelance",
    "tasks": [
      "Teach incident response, threat hunting, SIEM, SOAR, EDR/XDR, and email security using realistic enterprise scenarios.",
      "Build practical labs and assignments with tools such as Sentinel, Splunk, CrowdStrike, Defender XDR, Cortex, and Proofpoint.",
      "Guide learners through investigations, detection engineering, automation, and interview-ready workflows."
    ],
    "eligibility": "Freelance / Contract | Practical industry experience preferred",
    "overview": "Deliver engaging, hands-on cybersecurity training for students and working professionals.",
    "skills": "Strong hands-on security operations experience, lab-building ability, clear communication, and confidence leading live sessions."
  },
  {
    "slug": "outreach-marketing-intern",
    "title": "Outreach & Marketing Intern",
    "fullTitle": "Outreach & Marketing Intern",
    "group": "internships",
    "tasks": [
      "Create and schedule LinkedIn and Instagram posts, short-form content, and campaign assets.",
      "Research communities, events, college partnerships, and potential collaboration opportunities.",
      "Assist with email/WhatsApp outreach, event promotion, engagement tracking, and campaign reporting."
    ],
    "eligibility": "Student / Recent graduate | Internship",
    "overview": "Support CyberDefend community growth and brand visibility across digital channels.",
    "skills": "Writing and communication skills, Canva or similar tools, social media familiarity, creativity, and willingness to learn."
  }
];
export function addCareers({defs,pages,link,btn,section,esc,site}){
 defs.careers=['main','careers/'];
 for(const r of roles)defs['career-'+r.slug]=['main','careers/'+r.slug+'/'];
 const labels={experienced:'Professional roles',internships:'Internships',freelance:'Freelance & contract'};
 const mail=r=>'mailto:'+site.email+'?subject='+encodeURIComponent('Career application — '+r.title)+'&body='+encodeURIComponent('Hello CyberDefend team,\n\nI would like to apply for the '+r.title+' role.\n\nName:\nRelevant experience / current year of study:\nPortfolio, GitHub or LinkedIn link:\nAvailability:\n\nI have attached my CV for your review.\n');
 const apply=r=>`<a class="btn" href="${esc(mail(r))}">Apply by email <span aria-hidden="true">↗</span></a>`;
 const openApplication='mailto:'+site.email+'?subject='+encodeURIComponent('Open application — my preferred domain')+'&body='+encodeURIComponent('Hello CyberDefend team,\n\nI would like to be considered for an opportunity in my field.\n\nName:\nPreferred domain / role:\nOpportunity type (professional / internship / freelance):\nRelevant experience or course and year of study:\nPortfolio, project or LinkedIn links (if relevant):\nAvailability:\n\nI have attached my CV for your review.\n');
 const immediate=r=>r.immediate?'<span class="career-immediate">Immediate</span>':'';
 const card=r=>`<article class="career-role"><div><div class="career-role-kicker"><span class="overline">${labels[r.group]}</span>${immediate(r)}</div><h3><a href="${link('career-'+r.slug)}">${esc(r.title)}</a></h3><p class="career-eligibility">${esc(r.eligibility)}</p><p>${esc(r.overview)}</p></div><a class="career-arrow" href="${link('career-'+r.slug)}" aria-label="View ${esc(r.title)} role">↗</a></article>`;
 pages.careers={title:'Careers Across All Domains — Explore Opportunities',description:'Explore careers and internships across technical and non-technical domains at CyberDefend. View current roles or send an open application in your field.',body:`<section class="container careers-hero"><div class="breadcrumbs"><a href="${link('home')}">CyberDefend</a> / Careers</div><div class="careers-hero-grid"><div><span class="overline">CAREERS AT CYBERDEFEND</span><h1>Bring your curiosity.<br><em>Build what’s next.</em></h1><p class="lead">We welcome talent across all domains—technical and non-technical. Bring your strengths in technology, design, business, operations, education or another field, and help us build what comes next.</p><a class="btn" href="#open-roles">Explore current roles <span aria-hidden="true">↓</span></a><p><a class="text-link" href="#open-application">Apply in another domain <span aria-hidden="true">↗</span></a></p></div><aside class="careers-manifesto"><span class="overline">MANY SKILLS. A SHARED PURPOSE.</span><div><span>01</span><strong>Protect.</strong><p>Turn security expertise into action.</p></div><div><span>02</span><strong>Enable.</strong><p>Build tools, experiences and capability.</p></div><div><span>03</span><strong>Connect.</strong><p>Bring people and opportunities together.</p></div></aside></div><div class="career-facts"><span><strong>${roles.length}</strong> open opportunities</span><span><strong>3</strong> ways to contribute</span><span>Technical & non-technical domains</span></div></section>`+
 section(`<div class="careers-intro"><span class="overline">FIND YOUR PLACE</span><h2>Different strengths.<br><em>Meaningful work.</em></h2><p>Our teams bring together different disciplines. We welcome applications from all backgrounds, including software and AI, cybersecurity, design, marketing, sales, HR, finance, operations, research and education. Explore the roles below or introduce yourself through an open application.</p></div><div class="career-paths"><a href="#experienced"><span>01 / PROFESSIONALS</span><h3>Apply your experience.</h3><p>Security engineering, ServiceNow development and business growth.</p><b>Explore professional roles ↗</b></a><a href="#internships"><span>02 / EARLY CAREERS</span><h3>Start with curiosity.</h3><p>Threat research and community outreach.</p><b>Explore internships ↗</b></a><a href="#freelance"><span>03 / INSTRUCTORS</span><h3>Share what you know.</h3><p>Bring practical security experience into live training and labs.</p><b>Explore teaching ↗</b></a></div>`,'soft')+
 section(`<div id="open-roles" class="career-anchor"><span class="overline">OPEN OPPORTUNITIES</span><h2>Your next chapter<br><em>starts with a role.</em></h2><p>These are our currently listed roles. Read the responsibilities and requirements before applying. If your field is not listed, use the open application below to tell us where you could contribute.</p>${Object.entries(labels).map(([group,label])=>`<section id="${group}" class="career-group career-anchor" aria-labelledby="heading-${group}"><div class="career-group-head"><h3 id="heading-${group}">${label}</h3><span>${roles.filter(r=>r.group===group).length} ${group==='freelance'?'role':'roles'}</span></div>${roles.filter(r=>r.group===group).map(card).join('')}</section>`).join('')}</div>`)+
 section(`<div id="open-application" class="career-anchor career-apply-guide"><div><span class="overline">OPEN TO ALL DOMAINS</span><h2>Your field belongs<br><em>in the conversation.</em></h2><p>Don’t see a role that matches your skills? Send an open application for a professional role, internship or freelance opportunity. Tell us your preferred domain and the work you would like to do.</p><p>Open applications help us consider you for a suitable opportunity. Specific openings depend on project needs and team capacity.</p><a class="btn" href="${esc(openApplication)}">Send an open application <span aria-hidden="true">↗</span></a></div><div><h3>Students & college coordinators</h3><p>We welcome internship enquiries from all departments and disciplines. Share your preferred domains, dates and academic requirements, whether you are applying individually or coordinating a college cohort.</p>${btn('Explore internships','internships',true)}<p>For applications, email your CV and a short introduction to <a href="mailto:${site.email}">${site.email}</a>.</p></div></div>`)+
 section(`<div class="career-apply-guide"><div><span class="overline">A SIMPLE FIRST STEP</span><h2>Tell us what<br><em>you can bring.</em></h2><p>Open a role and select “Apply by email”. Add your CV, relevant work and a short introduction, then send your application to <a href="mailto:${site.email}">${site.email}</a>.</p></div><ol><li><strong>Choose your direction</strong><p>Check the requirements for a listed role, or share your preferred domain in an open application.</p></li><li><strong>Show your work</strong><p>Include relevant projects, research, a portfolio or examples of your experience.</p></li><li><strong>Add the practical details</strong><p>Share your availability and any questions about the role’s work arrangements.</p></li></ol></div>`,'soft')+
 section(`<div class="career-bottom"><div><h2>Have a question first?</h2><p>Ask us about a role or the application process.</p></div>${btn('Contact the team','contact')}</div>`)};
 for(const r of roles){pages['career-'+r.slug]={title:r.title+' — Careers',description:r.overview,body:`<section class="container career-detail-hero"><div class="breadcrumbs"><a href="${link('home')}">CyberDefend</a> / <a href="${link('careers')}">Careers</a> / ${esc(r.title)}</div><div class="career-role-kicker"><span class="overline">${labels[r.group]}</span>${immediate(r)}</div><h1>${esc(r.title)}</h1><p class="career-eligibility">${esc(r.eligibility)}</p><p class="lead">${esc(r.overview)}</p><div class="actions">${apply(r)}<a class="btn secondary" href="${link('careers')}#open-roles">All opportunities <span aria-hidden="true">↗</span></a></div></section>`+section(`<div class="career-detail-grid"><div><span class="overline">THE OPPORTUNITY</span><h2>What you’ll work on.</h2>${r.slug==='security-engineer'?'<p class="career-specialisms">Incident response · Threat hunting · SIEM · SOAR · EDR · XDR · Email security</p>':''}<ul class="career-task-list">${r.tasks.map(t=>`<li>${esc(t)}</li>`).join('')}</ul><h2>What you’ll bring.</h2><p>${esc(r.skills)}</p></div><aside class="career-application"><span class="overline">YOUR APPLICATION</span><h3>Make your introduction count.</h3><p>Send your CV and a short introduction. Include relevant work or portfolio links and your availability.</p>${r.immediate?'<p>This role is open for immediate joining.</p>':''}<p><strong>Email subject</strong><br>Career application — ${esc(r.title)}</p>${apply(r)}<p class="quiet">Opens your email app. Attach your CV before sending. You can also email <a href="mailto:${site.email}">${site.email}</a> directly.</p><div class="career-application-note"><p>Work location, schedule, compensation and start date will be confirmed by the team. Include any questions in your application.</p><p>Share only information relevant to your application. Please do not send identity documents or confidential client material.</p></div></aside></div>`)+section(`<div class="career-bottom"><div><span class="overline">EXPLORE YOUR OPTIONS</span><h2>Another role in mind?</h2><p>See where else your skills could fit at CyberDefend.</p></div>${btn('View all opportunities','careers',true)}</div>`,'soft')};}
 for(const domain of ['academy','services'])pages[domain+'_careers'].body=section(`<div class="career-bottom"><div><span class="overline">CAREERS AT CYBERDEFEND</span><h1>Find your next opportunity.</h1><p>We welcome applicants across all domains, including technical and non-technical fields. Explore listed roles, internships and the open application route.</p></div>${btn('Explore current openings','careers')}</div>`);
 const teaser=section(`<div class="career-home"><div><span class="overline">WORK WITH CYBERDEFEND</span><h2>Put your skills<br><em>to meaningful work.</em></h2><p>Bring your strengths in any domain. Explore technical and non-technical roles, internships and open applications.</p></div><div><span class="career-open-count">${roles.length} open opportunities</span>${btn('Explore careers','careers')}</div></div>`,'soft');
 pages.home.body=pages.home.body.replace('<section class="closing-section">',teaser+'<section class="closing-section">');
}
