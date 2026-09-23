export type Os20EmailSender = {
  connectedAccountId: string;
  fromEmail: string;
  fromName: string | null;
  host: string;
  port: number;
  secure: boolean;
  username: string;
};
