export interface RendererModule {
  id: string;
  nameAr: string;
  routes: string[];
  nav: Array<{ path: string; labelAr: string; icon: string }>;
}

export const moduleRegistry: RendererModule[] = [
  {
    id: "employees",
    nameAr: "الموظفون",
    routes: ["/employees", "/employees/:id"],
    nav: [{ path: "/employees", labelAr: "الموظفون", icon: "users" }],
  },
  {
    id: "leaves",
    nameAr: "الإجازات",
    routes: ["/leaves", "/leaves/new"],
    nav: [{ path: "/leaves", labelAr: "الإجازات", icon: "calendar" }],
  },
  {
    id: "documents",
    nameAr: "ملفات الموظفين",
    routes: [],
    nav: [{ path: "/documents", labelAr: "ملفات الموظفين", icon: "files" }],
  },
  {
    id: "decisions",
    nameAr: "القرارات",
    routes: [],
    nav: [{ path: "/decisions", labelAr: "القرارات", icon: "gavel" }],
  },
];