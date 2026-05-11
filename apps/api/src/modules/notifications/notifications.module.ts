import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggingNotificationEmailSender } from './logging-notification-email.sender';
import { NotificationsController } from './notifications.controller';
import { NOTIFICATION_EMAIL_SENDER } from './notifications.constants';
import { resolveNotificationEmailProvider } from './notifications.provider';
import { NotificationsService } from './notifications.service';
import { ResendNotificationEmailSender } from './resend-notification-email.sender';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    LoggingNotificationEmailSender,
    ResendNotificationEmailSender,
    {
      provide: NOTIFICATION_EMAIL_SENDER,
      inject: [
        ConfigService,
        LoggingNotificationEmailSender,
        ResendNotificationEmailSender,
      ],
      useFactory: (
        configService: ConfigService,
        loggingSender: LoggingNotificationEmailSender,
        resendSender: ResendNotificationEmailSender,
      ) => {
        const provider = resolveNotificationEmailProvider(configService);
        return provider === 'resend' ? resendSender : loggingSender;
      },
    },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
