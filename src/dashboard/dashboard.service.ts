import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(employeeId: string, role: string, dateString?: string) {
    let today = new Date();
    if (dateString) {
      // Split YYYY-MM-DD to avoid timezone shift
      const [y, m, d] = dateString.split('-');
      today = new Date(Number(y), Number(m) - 1, Number(d));
    }
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

    if (role === 'MANAGER') {
      // 1. Daily Appointments
      const todayAppointmentsCount = await this.prisma.customerService.count({
        where: { Date: { gte: today, lt: tomorrow } },
      });

      const yesterdayAppointmentsCount = await this.prisma.customerService.count({
        where: { Date: { gte: yesterday, lt: today } },
      });

      // 2. Expected Revenue
      const todayAppointments = await this.prisma.customerService.findMany({
        where: { Date: { gte: today, lt: tomorrow } },
      });
      const expectedRevenue = todayAppointments.reduce((sum, appt) => sum + appt.TotalValue, 0);

      // 3. Monthly Revenue
      const monthlyIncomeTxs = await this.prisma.cashFlowTransaction.findMany({
        where: {
          date: { gte: startOfMonth, lte: endOfMonth },
          type: 'INCOME',
          status: 'PAID',
        },
      });
      const monthlyRevenue = monthlyIncomeTxs.reduce((sum, tx) => sum + tx.amount, 0);
      const revenueGoal = 50000;

      // 4. Schedule
      const schedule = await this.prisma.customerService.findMany({
        where: { Date: { gte: today, lt: tomorrow } },
        orderBy: { Date: 'asc' },
        include: {
          Client: true,
          PerformedServices: {
            include: {
              Service: true,
              Employee: true,
            },
          },
        },
      });

      // 5. Client Retention Rate
      const totalClientsCount = await this.prisma.client.count();
      const recurringClients = await this.prisma.client.count({
        where: {
          CustomerServices: {
            // has more than 1 appointment
            // Prisma doesn't support 'having count > 1' directly via count cleanly,
            // we will query clients who have at least 2 appointments
          },
        },
      });
      // Alternate approach for retention: fetch clients with their appointments count
      const allClients = await this.prisma.client.findMany({
        select: {
          id: true,
          _count: {
            select: { CustomerServices: true }
          }
        }
      });
      const retryingClients = allClients.filter(c => c._count.CustomerServices > 1).length;
      const retentionRate = allClients.length > 0 ? Math.round((retryingClients / allClients.length) * 100) : 0;

      // 6. Product Upsell Rate (This month)
      const thisMonthAppointments = await this.prisma.customerService.findMany({
        where: { Date: { gte: startOfMonth, lte: endOfMonth } },
        include: { ConsumedItems: true }
      });
      const appsWithProducts = thisMonthAppointments.filter(a => a.ConsumedItems.length > 0).length;
      const upsellRate = thisMonthAppointments.length > 0 ? Math.round((appsWithProducts / thisMonthAppointments.length) * 100) : 0;

      // 7. Alerts (Pending Commissions & Pending Cashflow)
      const pendingCommissions = await this.prisma.performedServices.count({
        where: { isCommissionPaid: false, CustomerService: { Status: 'COMPLETED' } }
      });
      const pendingCashflow = await this.prisma.cashFlowTransaction.count({
        where: { status: 'PENDING' }
      });

      const alerts: string[] = [];
      if (pendingCommissions > 0) {
        alerts.push(`${pendingCommissions} commision(s) pending payment.`);
      }
      if (pendingCashflow > 0) {
        alerts.push(`${pendingCashflow} cash flow transaction(s) pending.`);
      }

      // 8. Activity Feed (Recent Appointments + New Clients)
      const recentAppointments = await this.prisma.customerService.findMany({
        where: { Status: 'COMPLETED' },
        orderBy: { Date: 'desc' },
        take: 10,
        include: { Client: true, PerformedServices: { include: { Service: true, Employee: true } } }
      });

      const recentClients = await this.prisma.client.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5
      });

      const activityFeed: any[] = [];
      recentAppointments.forEach(appt => {
        const artisanNames = Array.from(new Set(appt.PerformedServices.map(ps => ps.Employee.name))).join(', ');
        const serviceNames = appt.PerformedServices.map(ps => ps.Service.name).join(' & ');
        activityFeed.push({
          type: 'APPOINTMENT',
          icon: 'done_all',
          text: `<strong>${artisanNames}</strong> completed <em>${serviceNames}</em> for ${appt.Client.name}.`,
          date: appt.Date
        });
      });

      recentClients.forEach(client => {
        activityFeed.push({
          type: 'NEW_CLIENT',
          icon: 'person_add',
          text: `<strong>New Client</strong>: ${client.name} joined Studio A.`,
          date: client.createdAt
        });
      });

      const lowStockProducts = await this.prisma.products.findMany({
        where: { 
          OR: [
            { stock: { lt: 10 } },
            { totalVolume: { lt: 1000 } }
          ]
        },
      });
      
      const inventoryAlerts = lowStockProducts.map(product => {
        let details = `${product.stock} units left`;
        if (product.totalVolume !== null && product.unit) {
          const approxUnits = product.volumePerUnit ? (product.totalVolume / product.volumePerUnit).toFixed(1) : product.stock;
          details = `${product.totalVolume}${product.unit} left (~${approxUnits} units)`;
        }
        return {
          id: product.id,
          name: product.name,
          brand: product.brand,
          details
        };
      });

      // Sort activity feed by date desc
      activityFeed.sort((a, b) => b.date.getTime() - a.date.getTime());

      return {
        stats: {
          todayAppointments: todayAppointmentsCount,
          appointmentsDiff: todayAppointmentsCount - yesterdayAppointmentsCount,
          expectedRevenue,
          monthlyRevenue,
          revenueGoal,
          retentionRate,
          upsellRate,
          alerts
        },
        activityFeed: activityFeed.slice(0, 10),
        inventoryAlerts,
        schedule: schedule.map((appt) => {
          return {
            id: appt.id,
            time: appt.Date.toISOString(),
            endTime: appt.EndTime.toISOString(),
            totalValue: appt.TotalValue,
            clientName: appt.Client.name,
            services: appt.PerformedServices.map((ps) => ({
              serviceName: ps.Service.name,
              estimatedDuration: ps.Service.estimatedDuration,
              employeeName: ps.Employee.name,
            })),
          };
        }),
      };
    } else {
      // PROFESSIONAL role
      const schedule = await this.prisma.customerService.findMany({
        where: {
          Date: { gte: today, lt: tomorrow },
          PerformedServices: {
            some: { idEmployee: employeeId },
          },
        },
        orderBy: { Date: 'asc' },
        include: {
          Client: true,
          PerformedServices: {
            include: {
              Service: true,
              Employee: true,
            },
          },
        },
      });

      let totalDuration = 0;
      let totalPrice = 0;

      const formattedSchedule = schedule.map((appt) => {
        const totalEstimatedDuration = appt.PerformedServices.reduce((sum, ps) => sum + ps.Service.estimatedDuration, 0);
        
        totalDuration += totalEstimatedDuration;
        totalPrice += appt.TotalValue;

        return {
          id: appt.id,
          time: appt.Date.toISOString(),
          endTime: appt.EndTime.toISOString(),
          totalValue: appt.TotalValue,
          totalEstimatedDuration,
          clientName: appt.Client.name,
          services: appt.PerformedServices.map((ps) => ({
            serviceName: ps.Service.name,
            estimatedDuration: ps.Service.estimatedDuration,
            employeeName: ps.Employee.name,
          })),
        };
      });

      return {
        stats: {
          todayAppointments: schedule.length,
          totalDuration,
          expectedRevenue: totalPrice,
          alerts: []
        },
        activityFeed: [], // Professionals might not need full activity feed, or it can be empty
        schedule: formattedSchedule,
      };
    }
  }
}
