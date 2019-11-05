import {Component, HostListener, OnInit} from '@angular/core';
import {ImageCroppedEvent, CropperPosition} from 'ngx-image-cropper';
import {WebcamInitError, WebcamImage, WebcamUtil} from 'ngx-webcam';
import {Subject, Observable, BehaviorSubject, forkJoin} from 'rxjs';
import {INIT_IMAGE_BASE_64} from '../constant';
import * as smartcrop from 'smartcrop';
import {NgOpenCVService, OpenCVLoadResult} from 'ng-open-cv';
import {filter, switchMap, tap} from 'rxjs/operators';
import {MatDialog, MatSnackBar} from '@angular/material';
import {OpenCvService} from '../core/http/open-cv.service';
import {DialogTakePhotoComponent} from '../dialog-take-photo/dialog-take-photo.component';


@Component({
  selector: 'app-avatar',
  templateUrl: './avatar.component.html',
  styleUrls: ['./avatar.component.scss']
})
export class AvatarComponent implements OnInit {
  public imageChangedEvent: any = '';
  public croppedImage: any = '';
  public imageBase64 = INIT_IMAGE_BASE_64;
  public img: any;
  public currentFace = 0;
  message = 'No face in camera!';
  responseValidateImage: any;
  image: any;
  isEditByKeyBoard = false;
  public cropper: CropperPosition = {
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 0
  };
  public options = {
    width: 30,
    height: 40,
    minScale: 0.8,
    boost: null,
    debug: true
  };

  constructor(
    private snackBar: MatSnackBar,
    private openCvHttp: OpenCvService,
    public dialog: MatDialog
  ) {
  }

  public ngOnInit(): void {
  }


  validatePhoto(croppedImage) {
    croppedImage = croppedImage.substring(22, croppedImage.length);
    this.openCvHttp.validatorImage(croppedImage).subscribe(res => {
      this.responseValidateImage = res;
      this.image = `data:image/png;base64,${res[0].image_removed_background}`;
      this.snackBar.open(res[0].message, '', {
        duration: 2000,
      });
    });
  }

  openDialogTakePhoto() {
    const dialogRef = this.dialog.open(DialogTakePhotoComponent, {
      width: '1200px',
      data: {}
    });

    dialogRef.afterClosed().subscribe(result => {
      console.log('The dialog was closed');
      this.croppedImage = result;
    });
  }

  fileChangeEvent(event: any): void {
    this.imageChangedEvent = event;

    const dialogRef = this.dialog.open(DialogTakePhotoComponent, {
      width: '1200px',
      data: {
        imageChangedEvent: event
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      console.log('The dialog was closed');
      this.croppedImage = result;
    });
  }

}
