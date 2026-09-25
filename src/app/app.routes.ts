import { Routes } from "@angular/router";
import { authGuard } from "./core/guards/auth.guard";
import { roleGuard } from "./core/guards/role.guard";

export const routes: Routes = [
  {
    path: "",
    loadComponent: () =>
      import("./home/home.component").then((m) => m.HomeComponent),
  },
  {
    path: "home",
    redirectTo: "",
    pathMatch: "full",
  },
  {
    path: "login",
    loadComponent: () =>
      import("./login/login.component").then((m) => m.LoginComponent),
  },
  {
    path: "signout",
    loadComponent: () =>
      import("./signout/signout.component").then((m) => m.SignoutComponent),
  },
  {
    path: "logout",
    redirectTo: "signout",
    pathMatch: "full",
  },
  {
    path: "unauthorized",
    loadComponent: () =>
      import("./unauthorized/unauthorized.component").then((m) => m.UnauthorizedComponent),
  },
  {
    path: "customer-services",
    loadComponent: () =>
      import("./customer-services/customer-services.component")
        .then((m) => m.CustomerServicesComponent),
  },
  {
    path: "admin-registration",
    loadComponent: () =>
      import("./admin-registration/admin-registration.component")
        .then((m) => m.AdminRegistrationComponent),
  },
  {
    path: "admin/register",
    redirectTo: "admin-registration",
    pathMatch: "full",
  },
  {
    path: "service-selection",
    canActivate: [authGuard, roleGuard],
    data: { roles: ["Professional", "Admin"] },
    loadComponent: () =>
      import("./service-selection/service-selection.component")
        .then((m) => m.ServiceSelectionComponent),
  },
  {
    path: "professional-dashboard-detail",
    loadComponent: () =>
      import("./professional-dashboard-detail/professional-dashboard-detail.component")
        .then((m) => m.ProfessionalDashboardDetailComponent),
  },
  {
    path: "professional-dashboard-detail/:id",
    loadComponent: () =>
      import("./professional-dashboard-detail/professional-dashboard-detail.component")
        .then((m) => m.ProfessionalDashboardDetailComponent),
  },
  {
    path: "professional-dashboard-detai",
    redirectTo: "professional-dashboard-detail",
    pathMatch: "full",
  },
  {
    path: "professional-dashboard-detai/:id",
    redirectTo: "professional-dashboard-detail/:id",
    pathMatch: "full",
  },

  // -------------------------------------------------------------
  // CUSTOMER PROTECTED ROUTES (Customer & Admin)
  // -------------------------------------------------------------
  {
    path: "customer-dashboard",
    canActivate: [authGuard, roleGuard],
    data: { roles: ["Customer", "Admin"] },
    loadComponent: () =>
      import("./customer-dashboard/customer-dashboard.component")
        .then((m) => m.CustomerDashboardComponent),
  },
  {
    path: "customer-dashboard/:id",
    canActivate: [authGuard, roleGuard],
    data: { roles: ["Customer", "Admin"] },
    loadComponent: () =>
      import("./customer-dashboard/customer-dashboard.component")
        .then((m) => m.CustomerDashboardComponent),
  },
  {
    path: "customer-booked-services",
    canActivate: [authGuard, roleGuard],
    data: { roles: ["Customer", "Admin"] },
    loadComponent: () =>
      import("./customer-booked-services/customer-booked-services.component")
        .then((m) => m.CustomerBookedServicesComponent),
  },
  {
    path: "customer-jobs",
    redirectTo: "customer-booked-services",
    pathMatch: "full",
  },
  // { path: "customer-page", redirectTo: "customer-dashboard", pathMatch: "full" },
  {
    path: "customer-notifications",
    canActivate: [authGuard, roleGuard],
    data: { roles: ["Customer", "Admin"] },
    loadComponent: () =>
      import("./customer-notifications/customer-notifications.component")
        .then((m) => m.CustomerNotificationsComponent),
  },
  {
    path: "customer-dashboard/notifications",
    redirectTo: "customer-notifications",
    pathMatch: "full",
  },
  {
    path: "profile",
    canActivate: [authGuard, roleGuard],
    data: { roles: ["Customer", "Admin"] },
    loadComponent: () =>
      import("./profile/profile.component")
        .then((m) => m.ProfileComponent),
  },
  { path: "customer-profile", redirectTo: "customer-dashboard", pathMatch: "full" },

  // -------------------------------------------------------------
  // PUBLIC PROFESSIONAL DETAIL ROUTES (Accessible to ALL Users)
  // -------------------------------------------------------------
  {
    path: "professional-dashboard/detail",
    loadComponent: () =>
      import("./professional-dashboard-detail/professional-dashboard-detail.component")
        .then((m) => m.ProfessionalDashboardDetailComponent),
  },
  {
    path: "professional-dashboard/detail/:id",
    loadComponent: () =>
      import("./professional-dashboard-detail/professional-dashboard-detail.component")
        .then((m) => m.ProfessionalDashboardDetailComponent),
  },

  // -------------------------------------------------------------
  // PROFESSIONAL PROTECTED ROUTES (Professional & Admin)
  // -------------------------------------------------------------
  {
    path: "professional-dashboard",
    canActivate: [authGuard, roleGuard],
    data: { roles: ["Professional", "Admin"] },
    loadComponent: () =>
      import("./professional-dashboard/professional-dashboard.component")
        .then((m) => m.ProfessionalDashboardComponent),
  },
  {
    path: "professional-dashboard/:id",
    canActivate: [authGuard, roleGuard],
    data: { roles: ["Professional", "Admin"] },
    loadComponent: () =>
      import("./professional-dashboard/professional-dashboard.component")
        .then((m) => m.ProfessionalDashboardComponent),
  },
  { path: "professional-page", redirectTo: "professional-dashboard", pathMatch: "full" },
  {
    path: "jobs",
    canActivate: [authGuard, roleGuard],
    data: { roles: ["Professional"] },
    loadComponent: () =>
      import("./jobs/jobs.component").then((m) => m.JobsComponent),
  },
  {
    path: "jobs/:id",
    canActivate: [authGuard, roleGuard],
    data: { roles: ["Professional"] },
    loadComponent: () =>
      import("./jobs/jobs.component").then((m) => m.JobsComponent),
  },
  { path: "professional-jobs", redirectTo: "jobs", pathMatch: "full" },
  { path: "pro-jobs", redirectTo: "jobs", pathMatch: "full" },
  {
    path: "professional-profile",
    canActivate: [authGuard, roleGuard],
    data: { roles: ["Professional", "Admin"] },
    loadComponent: () =>
      import("../professional-profile/professional-profile.component")
        .then((m) => m.ProfessionalProfileComponent),
  },
  {
    path: "professional-notifications",
    canActivate: [authGuard, roleGuard],
    data: { roles: ["Professional", "Admin"] },
    loadComponent: () =>
      import("./professional-notifications/professional-notifications.component")
        .then((m) => m.ProfessionalNotificationsComponent),
  },
  {
    path: "professional-dashboard/notifications",
    redirectTo: "professional-notifications",
    pathMatch: "full",
  },
  {
    path: "resume-upload",
    canActivate: [authGuard, roleGuard],
    data: { roles: ["Professional", "Admin"] },
    loadComponent: () =>
      import("./resume-upload/resume-upload.component")
        .then((m) => m.ResumeUploadComponent),
  },
  {
    path: "certificate-upload",
    canActivate: [authGuard, roleGuard],
    data: { roles: ["Professional", "Admin"] },
    loadComponent: () =>
      import("./certificate-upload/certificate-upload.component")
        .then((m) => m.CertificateUploadComponent),
  },
  {
    path: "portfolio-upload",
    canActivate: [authGuard, roleGuard],
    data: { roles: ["Professional", "Admin"] },
    loadComponent: () =>
      import("./portfolio-upload/portfolio-upload.component")
        .then((m) => m.PortfolioUploadComponent),
  },
  {
    path: "verification-upload",
    canActivate: [authGuard, roleGuard],
    data: { roles: ["Professional", "Admin"] },
    loadComponent: () =>
      import("./verification-upload/verification-upload.component")
        .then((m) => m.VerificationUploadComponent),
  },
  { path: "ab", redirectTo: "professional-profile", pathMatch: "full" },

  // -------------------------------------------------------------
  // ADMIN PROTECTED ROUTES (Admin Only)
  // -------------------------------------------------------------
  {
    path: "admin-dashboard",
    canActivate: [authGuard, roleGuard],
    data: { roles: ["Admin"] },
    loadComponent: () =>
      import("./admin-dashboard/admin-dashboard.component")
        .then((m) => m.AdminDashboardComponent),
  },
  { path: "admin-page", redirectTo: "admin-dashboard", pathMatch: "full" },
  {
    path: "admin-users",
    canActivate: [authGuard, roleGuard],
    data: { roles: ["Admin"] },
    loadComponent: () =>
      import("./admin-users/admin-users.component")
        .then((m) => m.AdminUsersComponent),
  },
  {
    path: "admin-professionals",
    canActivate: [authGuard, roleGuard],
    data: { roles: ["Admin"] },
    loadComponent: () =>
      import("./admin-users/admin-users.component")
        .then((m) => m.AdminUsersComponent),
  },
  {
    path: "admin-services",
    canActivate: [authGuard, roleGuard],
    data: { roles: ["Admin"] },
    loadComponent: () =>
      import("../admin-services/admin-services/admin-services.component")
        .then((m) => m.AdminServicesComponent),
  },
  {
    path: "admin-logs",
    canActivate: [authGuard, roleGuard],
    data: { roles: ["Admin"] },
    loadComponent: () =>
      import("./admin-logs/admin-logs.component")
        .then((m) => m.AdminLogsComponent),
  },
  {
    path: "verification-list",
    canActivate: [authGuard, roleGuard],
    data: { roles: ["Admin"] },
    loadComponent: () =>
      import("./verification-list/verification-list.component")
        .then((m) => m.VerificationListComponent),
  },

  { path: "**", redirectTo: "", pathMatch: "full" },
];
